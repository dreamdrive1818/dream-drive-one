import "dotenv/config";
import "reflect-metadata";
import { gzipSync } from "zlib";
import { mkdirSync } from "fs";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { uploadRoot } from "./lib/cloudinary";
import { prisma } from "./lib/prisma";
import { warmPublicCache } from "./lib/warm-cache";

function corsOrigins() {
  const raw =
    process.env.CORS_ORIGINS ||
    [process.env.WEB_ORIGIN, process.env.ADMIN_ORIGIN]
      .filter(Boolean)
      .join(",");
  const list = (raw || "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const extra of [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
  ]) {
    if (!list.includes(extra)) list.push(extra);
  }
  return list;
}

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  if (corsOrigins().includes(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin)
    || /^https?:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const filesDir = uploadRoot();
  mkdirSync(filesDir, { recursive: true });
  app.useStaticAssets(filesDir, { prefix: "/v1/files/" });
  app.enableCors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
    allowedHeaders: [
      "content-type",
      "authorization",
      "x-internal-token",
      "x-ops-city-id",
      "x-ops-branch-id",
    ],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-XSS-Protection", "0");
    const path = (req.originalUrl ?? req.url ?? "").split("?")[0];
    if (req.method === "GET" && path.startsWith("/v1/public/")) {
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    }
    const started = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - started;
      if (ms >= 800) {
        console.warn(`slow ${req.method} ${path} ${ms}ms`);
      }
    });
    const accept = String(req.headers["accept-encoding"] || "");
    if (req.method === "GET" && /gzip/i.test(accept)) {
      const send = res.send.bind(res);
      res.send = ((body?: unknown) => {
        if (res.headersSent || res.getHeader("Content-Encoding")) return send(body as never);
        const contentType = String(res.getHeader("Content-Type") || "");
        if (contentType && !/json|text|javascript|xml|svg/i.test(contentType)) return send(body as never);
        const buf =
          body == null
            ? Buffer.alloc(0)
            : Buffer.isBuffer(body)
              ? body
              : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
        if (buf.length < 900) return send(body as never);
        try {
          const gz = gzipSync(buf);
          res.setHeader("Content-Encoding", "gzip");
          res.setHeader("Vary", "Accept-Encoding");
          if (!res.getHeader("Content-Type")) {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
          }
          res.setHeader("Content-Length", String(gz.length));
          return send(gz);
        } catch {
          return send(body as never);
        }
      }) as typeof res.send;
    }
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  void prisma.$connect().catch((err) => {
    console.warn("prisma connect:", err instanceof Error ? err.message : err);
  });
  await app.listen(port, "0.0.0.0");
  console.log(`api listening on ${port}`);
  const warm = async () => {
    await warmPublicCache();
    const base = `http://127.0.0.1:${port}`;
    await Promise.allSettled([
      fetch(`${base}/v1/public/home`),
      fetch(`${base}/v1/public/search`),
      fetch(`${base}/v1/public/catalog-config`),
      fetch(`${base}/v1/public/cities`),
      fetch(`${base}/v1/public/config`),
      fetch(`${base}/v1/public/blogs`),
      fetch(`${base}/v1/public/testimonials`),
      fetch(`${base}/v1/public/airports`),
      fetch(`${base}/v1/public/packages`),
    ]);
  };
  void warm();
  const refresh = setInterval(() => {
    void warm();
  }, 4 * 60 * 1000);
  refresh.unref?.();
}

bootstrap();

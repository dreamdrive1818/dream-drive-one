import "dotenv/config";
import "reflect-metadata";
import { mkdirSync } from "fs";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { uploadRoot } from "./lib/cloudinary";
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
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  console.log(`api listening on ${port}`);
  void warmPublicCache();
}

bootstrap();

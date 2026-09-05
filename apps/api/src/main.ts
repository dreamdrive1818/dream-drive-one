import "dotenv/config";
import "reflect-metadata";
import { mkdirSync } from "fs";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { uploadRoot } from "./lib/cloudinary";

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
  return list;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const filesDir = uploadRoot();
  mkdirSync(filesDir, { recursive: true });
  app.useStaticAssets(filesDir, { prefix: "/v1/files/" });
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
    allowedHeaders: ["content-type", "authorization", "x-internal-token"],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-XSS-Protection", "0");
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`api listening on ${port}`);
}

bootstrap();

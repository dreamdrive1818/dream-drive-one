import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.SOCKET_CORS_ORIGIN?.split(",") ?? true,
  });
  const port = Number(process.env.SOCKET_PORT ?? 4010);
  await app.listen(port);
  console.log(`socket listening on ${port}`);
}

bootstrap();

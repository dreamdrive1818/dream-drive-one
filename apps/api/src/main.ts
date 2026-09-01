import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`api listening on ${port}`);
}

bootstrap();

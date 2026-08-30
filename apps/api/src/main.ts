import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix("v1");
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3999);
  await app.listen(port);
  console.log(`api listening on ${port}`);
}

bootstrap();

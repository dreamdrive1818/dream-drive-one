import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
  const port = Number(process.env.DOCUMENT_PORT ?? process.env.PORT ?? 4005);
  await app.listen(port);
  console.log("document-service listening on " + port);
}
bootstrap();

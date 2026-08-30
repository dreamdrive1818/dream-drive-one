import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { attachGatewayProxy } from "./proxy.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableCors();
  attachGatewayProxy(app);
  const port = Number(process.env.GATEWAY_PORT ?? process.env.PORT ?? 4000);
  await app.listen(port);
  console.log("gateway listening on " + port);
}
bootstrap();

import "dotenv/config";
import "reflect-metadata";
import { createServer, type Server } from "node:http";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

function startHealthServer(): Server {
  const port = Number(process.env.PORT ?? 8080);
  const server = createServer((req, res) => {
    const path = req.url?.split("?")[0];
    if (path === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ service: "worker", status: "ok" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`worker health listening on ${port}`);
  });
  return server;
}

async function bootstrap() {
  const health = startHealthServer();
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log(
    `worker started (pid ${process.pid}). Jobs: hold-sweeper, notify-retry, webhook-replay`
  );

  const shutdown = async () => {
    health.close();
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap();

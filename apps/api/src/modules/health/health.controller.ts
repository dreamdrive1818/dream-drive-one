import { Controller, Get } from "@nestjs/common";
import { isRedisReady } from "../../lib/cache";
import { isSmtpConfigured, mailProvider } from "../../lib/mail-status";

@Controller()
export class HealthController {
  @Get("health")
  ok() {
    return {
      service: "api",
      status: "ok",
      redis: isRedisReady() ? "ready" : "memory",
      smtp: isSmtpConfigured() ? "configured" : "missing",
      mailer: mailProvider(),
    };
  }
}

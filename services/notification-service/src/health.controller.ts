import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  ok() {
    return { service: "notification-service", status: "ok" };
  }
}

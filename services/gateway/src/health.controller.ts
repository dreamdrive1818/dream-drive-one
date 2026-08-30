import { Controller, Get } from "@nestjs/common";

const SERVICES = [
  ["identity", process.env.IDENTITY_URL ?? "http://localhost:4001"],
  ["catalog", process.env.CATALOG_URL ?? "http://localhost:4002"],
  ["booking", process.env.BOOKING_URL ?? "http://localhost:4003"],
  ["payment", process.env.PAYMENT_URL ?? "http://localhost:4004"],
  ["document", process.env.DOCUMENT_URL ?? "http://localhost:4005"],
  ["fleet", process.env.FLEET_URL ?? "http://localhost:4006"],
  ["partner", process.env.PARTNER_URL ?? "http://localhost:4007"],
  ["notification", process.env.NOTIFICATION_URL ?? "http://localhost:4008"],
  ["platform", process.env.PLATFORM_URL ?? "http://localhost:4009"],
] as const;

@Controller()
export class HealthController {
  @Get("health")
  async ok() {
    const checks: Record<string, string> = {};
    await Promise.all(
      SERVICES.map(async ([name, url]) => {
        try {
          const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
          checks[name] = res.ok ? "ok" : `down:${res.status}`;
        } catch {
          checks[name] = "down";
        }
      })
    );
    const allOk = Object.values(checks).every((v) => v === "ok");
    return { service: "gateway", status: allOk ? "ok" : "degraded", checks };
  }
}

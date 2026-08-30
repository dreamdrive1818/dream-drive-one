import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

const BOOKING = process.env.BOOKING_URL ?? "http://localhost:4003";
const NOTIFY = process.env.NOTIFICATION_URL ?? "http://localhost:4008";
const token = process.env.INTERNAL_TOKEN ?? "dev-internal";

@Injectable()
export class HoldSweeperJob {
  private readonly logger = new Logger(HoldSweeperJob.name);

  @Cron(CronExpression.EVERY_MINUTE)
  async handle() {
    try {
      const res = await fetch(`${BOOKING}/internal/holds/expire`, {
        method: "POST",
        headers: { "x-internal-token": token, "content-type": "application/json" },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      this.logger.debug(`hold-sweeper ${res.status} ${JSON.stringify(json)}`);
    } catch (err) {
      this.logger.warn(`hold-sweeper failed: ${(err as Error).message}`);
    }
  }
}

@Injectable()
export class NotifyRetryJob {
  private readonly logger = new Logger(NotifyRetryJob.name);

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handle() {
    try {
      const res = await fetch(`${NOTIFY}/internal/notify/retry`, {
        method: "POST",
        headers: { "x-internal-token": token, "content-type": "application/json" },
        body: "{}",
      });
      this.logger.debug(`notify-retry ${res.status}`);
    } catch (err) {
      this.logger.warn(`notify-retry failed: ${(err as Error).message}`);
    }
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

const API = process.env.API_URL ?? "http://localhost:4000";
const token = process.env.INTERNAL_TOKEN ?? "dev-internal";

@Injectable()
export class HoldSweeperJob {
  private readonly logger = new Logger(HoldSweeperJob.name);

  @Cron(CronExpression.EVERY_MINUTE)
  async handle() {
    try {
      const res = await fetch(`${API}/internal/holds/expire`, {
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
export class NoShowSweeperJob {
  private readonly logger = new Logger(NoShowSweeperJob.name);

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handle() {
    try {
      const res = await fetch(`${API}/internal/bookings/mark-no-show`, {
        method: "POST",
        headers: { "x-internal-token": token, "content-type": "application/json" },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      this.logger.debug(`no-show-sweeper ${res.status} ${JSON.stringify(json)}`);
    } catch (err) {
      this.logger.warn(`no-show-sweeper failed: ${(err as Error).message}`);
    }
  }
}

@Injectable()
export class NotifyRetryJob {
  private readonly logger = new Logger(NotifyRetryJob.name);

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handle() {
    try {
      const res = await fetch(`${API}/internal/notify/retry`, {
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

@Injectable()
export class VehicleExpiryJob {
  private readonly logger = new Logger(VehicleExpiryJob.name);

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handle() {
    try {
      const res = await fetch(`${API}/internal/vehicles/expiry-alerts`, {
        method: "POST",
        headers: { "x-internal-token": token, "content-type": "application/json" },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      this.logger.log(`vehicle-expiry ${res.status} ${JSON.stringify(json)}`);
    } catch (err) {
      this.logger.warn(`vehicle-expiry failed: ${(err as Error).message}`);
    }
  }
}

@Injectable()
export class SettlementWeeklyJob {
  private readonly logger = new Logger(SettlementWeeklyJob.name);

  @Cron(CronExpression.EVERY_WEEK)
  async handle() {
    try {
      const res = await fetch(`${API}/internal/settlements/generate-weekly`, {
        method: "POST",
        headers: { "x-internal-token": token, "content-type": "application/json" },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      this.logger.log(`settlement-weekly ${res.status} ${JSON.stringify(json)}`);
    } catch (err) {
      this.logger.warn(`settlement-weekly failed: ${(err as Error).message}`);
    }
  }
}

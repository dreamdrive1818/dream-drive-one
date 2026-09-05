import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { HoldSweeperJob, NotifyRetryJob, NoShowSweeperJob, VehicleExpiryJob, SettlementWeeklyJob } from "./jobs/hold-sweeper.job";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    ScheduleModule.forRoot(),
  ],
  providers: [HoldSweeperJob, NotifyRetryJob, NoShowSweeperJob, VehicleExpiryJob, SettlementWeeklyJob],
})
export class AppModule {}


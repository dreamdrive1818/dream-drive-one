import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { HoldSweeperJob } from "./jobs/hold-sweeper.job";
import { NotifyRetryJob } from "./jobs/notify-retry.job";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    ScheduleModule.forRoot(),
  ],
  providers: [HoldSweeperJob, NotifyRetryJob],
})
export class AppModule {}


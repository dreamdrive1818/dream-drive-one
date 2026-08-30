import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { NotifyController } from "./notify.controller";
import { NotifyEngine } from "./notify.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] })],
  controllers: [HealthController, NotifyController],
  providers: [NotifyEngine],
})
export class AppModule {}


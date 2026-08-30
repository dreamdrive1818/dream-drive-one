import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { PlatformController } from "./platform.controller";
import { PlatformEngine } from "./platform.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] })],
  controllers: [HealthController, PlatformController],
  providers: [PlatformEngine],
})
export class AppModule {}


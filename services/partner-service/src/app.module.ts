import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { PartnerController } from "./partner.controller";
import { PartnerEngine } from "./partner.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] })],
  controllers: [HealthController, PartnerController],
  providers: [PartnerEngine],
})
export class AppModule {}


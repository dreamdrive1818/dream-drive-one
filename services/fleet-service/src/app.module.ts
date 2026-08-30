import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { FleetController } from "./fleet.controller";
import { FleetEngine } from "./fleet.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" })],
  controllers: [HealthController, FleetController],
  providers: [FleetEngine],
})
export class AppModule {}


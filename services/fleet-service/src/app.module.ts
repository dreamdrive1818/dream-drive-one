import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { FleetController } from "./fleet.controller";
import { FleetEngine } from "./fleet.service";
import { MaintenanceController } from "./maintenance.controller";
import { MaintenanceEngine } from "./maintenance.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" })],
  controllers: [HealthController, FleetController, MaintenanceController],
  providers: [FleetEngine, MaintenanceEngine],
})
export class AppModule {}


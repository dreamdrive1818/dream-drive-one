import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BookingGateway } from "./gateways/booking.gateway";
import { HealthController } from "./health.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] })],
  controllers: [HealthController],
  providers: [BookingGateway],
})
export class AppModule {}


import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BookingGateway } from "./gateways/booking.gateway";
import { HealthController } from "./health.controller";
import { InternalController } from "./internal.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" })],
  controllers: [HealthController, InternalController],
  providers: [BookingGateway],
})
export class AppModule {}


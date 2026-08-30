import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { BookingController } from "./booking.controller";
import { BookingEngine } from "./booking.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] })],
  controllers: [HealthController, BookingController],
  providers: [BookingEngine],
})
export class AppModule {}


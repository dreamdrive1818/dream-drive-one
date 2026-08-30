import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { PaymentController } from "./payment.controller";
import { PaymentEngine } from "./payment.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] })],
  controllers: [HealthController, PaymentController],
  providers: [PaymentEngine],
})
export class AppModule {}


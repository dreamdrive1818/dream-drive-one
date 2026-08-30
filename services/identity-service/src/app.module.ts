import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { IdentityController } from "./identity.controller";
import { IdentityService } from "./identity.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] })],
  controllers: [HealthController, IdentityController],
  providers: [IdentityService],
})
export class AppModule {}


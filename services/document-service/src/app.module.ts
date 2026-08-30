import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { DocumentController } from "./document.controller";
import { DocumentEngine } from "./document.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" })],
  controllers: [HealthController, DocumentController],
  providers: [DocumentEngine],
})
export class AppModule {}


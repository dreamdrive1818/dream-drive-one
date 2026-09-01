import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthMiddleware } from "./auth.middleware";
import { HealthController } from "./modules/health/health.controller";
import { IdentityController } from "./modules/identity/identity.controller";
import { IdentityService } from "./modules/identity/identity.service";
import { CatalogController } from "./modules/catalog/catalog.controller";
import { CatalogService } from "./modules/catalog/catalog.service";
import { BookingController } from "./modules/booking/booking.controller";
import { BookingEngine } from "./modules/booking/booking.service";
import { PaymentController } from "./modules/payment/payment.controller";
import { PaymentEngine } from "./modules/payment/payment.service";
import { DocumentController } from "./modules/document/document.controller";
import { DocumentEngine } from "./modules/document/document.service";
import { FleetController } from "./modules/fleet/fleet.controller";
import { FleetEngine } from "./modules/fleet/fleet.service";
import { PartnerController } from "./modules/partner/partner.controller";
import { PartnerEngine } from "./modules/partner/partner.service";
import { NotifyController } from "./modules/notification/notify.controller";
import { NotifyEngine } from "./modules/notification/notify.service";
import { PlatformController } from "./modules/platform/platform.controller";
import { PlatformEngine } from "./modules/platform/platform.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../packages/database/.env"],
    }),
  ],
  controllers: [
    HealthController,
    IdentityController,
    CatalogController,
    BookingController,
    PaymentController,
    DocumentController,
    FleetController,
    PartnerController,
    NotifyController,
    PlatformController,
  ],
  providers: [
    AuthMiddleware,
    IdentityService,
    CatalogService,
    BookingEngine,
    PaymentEngine,
    DocumentEngine,
    FleetEngine,
    PartnerEngine,
    NotifyEngine,
    PlatformEngine,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes("*");
  }
}

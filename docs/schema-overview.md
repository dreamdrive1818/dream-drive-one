# Database schema overview

Single PostgreSQL database for MVP. Prisma file: `packages/database/prisma/schema.prisma`.

Each microservice is the **only writer** of its tables.

| Service | Tables |
| --- | --- |
| identity | User, Role, UserRole, CustomerProfile, Address, AuditLog, DeviceToken, StaffScope |
| fleet | City, Branch, Vehicle, VehicleDocument, AvailabilityBlock, Driver*, Workshop, Maintenance*, Inspection*, AirportTerminal |
| catalog | CarModel, CarImage, PricingRule, CityPairRate, TourPackage, TourDay, TripExtra, SubscriptionPlan |
| booking | Quote, Booking, BookingStatusHistory, BookingExtra, Subscription |
| payment | Payment, PaymentAttempt, Invoice, InvoiceLine, SecurityDeposit, Refund, Wallet, WalletTxn |
| document | KycCase, KycDocument, ZohoSubmission, AgreementTemplate, Agreement, SignatureEnvelope |
| partner | Partner, PartnerContract, CommissionRule, LedgerEntry, Settlement, SettlementLine |
| platform | Cms*, Banner, Blog*, Media, PageMetadata, Testimonial, Offer*, Loyalty, Referral, Review, Ticket*, Lead* |
| notification | NotificationTemplate, NotificationLog |

Money is stored as **integer paise**. Timestamps UTC; display IST.

## Core relations

```
User 1─n Booking ─1 Vehicle ─n CarModel
Booking 1─n Payment
Booking 1─1 KycCase
Booking 1─n Agreement ─1 SignatureEnvelope
Vehicle n─1 Partner
Booking COMPLETED → LedgerEntry → Settlement
```

# Implementation plan (client + developers)

Dream-Drive becomes a **microservice car rental platform**: Next.js website, Next.js admin, Expo mobile, NestJS services, PostgreSQL, Firebase Auth, Razorpay, Leegality, Zoho Forms.

The live site today is a React app writing Firestore plus a small Express OTP/Zoho sidecar. This folder is the replacement architecture.

## What we will build (plain language)

Customers search cars, see real availability, book self-drive or chauffeur trips, pay on Razorpay, complete KYC (website or Zoho Form), sign the rental agreement on Leegality, and track the trip on web or mobile.

Admin runs multiple cities and branches: fleet, bookings, KYC, money, partners, offers, and reports. Partners do **not** get a login. Delivery-executive operations are **not** in scope.

## Services (10)

Gateway → Identity, Catalog, Booking, Payments, Documents, Fleet, Partners, Notifications, Platform (CMS/CRM/offers/reports).

## Documents in this folder

| Doc | Use |
| --- | --- |
| [00-overview](00-overview.md) | Client intro |
| [01-architecture](01-architecture.md) | Folder structure |
| [modules](modules/README.md) | All 22 features (APIs, tables, RBAC, priority) |
| [flows](flows.md) | Booking, payment, KYC, Zoho→Leegality, multi-city, partner ledger |
| [schema-overview](schema-overview.md) | Database map |
| [api-routes](api-routes.md) | Route list per service |
| [pages-and-screens](pages-and-screens.md) | Web, admin, mobile screens |
| [security-deployment](security-deployment.md) | Checklists + cutover |
| [sprint-plan](sprint-plan.md) | 4-week MVP |

## 4-week promise (honest)

Weeks 1–4 deliver a **paid, KYC’d, e-signed self-drive/with-driver booking** plus admin ops. Subscriptions, partner payouts, workshop, wallet, and the store-ready mobile app follow after that path works.

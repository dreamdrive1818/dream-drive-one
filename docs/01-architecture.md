# Folder structure

```
dream-drive-MS/
├── apps/
│   ├── web/                    # Next.js 15 — public site + customer dashboard
│   ├── admin/                  # Next.js 15 — operations console
│   └── mobile/                 # Expo (React Native) customer app
├── services/
│   ├── gateway/                # NestJS HTTP gateway (port 4000)
│   ├── identity-service/       # users, roles, audit
│   ├── catalog-service/        # cars, search, availability, pricing
│   ├── booking-service/        # all rental types, lifecycle
│   ├── payment-service/        # Razorpay, invoices, deposits, wallet
│   ├── document-service/       # KYC, Zoho, Leegality, PDF
│   ├── fleet-service/          # vehicles, workshop, handover, drivers, cities
│   ├── partner-service/        # partners, commission, ledger
│   ├── notification-service/   # email, later SMS/WhatsApp
│   └── platform-service/       # CMS, CRM, offers, loyalty, reviews, support, reports
├── packages/
│   ├── database/               # Prisma schema + migrations
│   ├── shared-types/           # DTOs, enums, events
│   └── config/                 # env validation
├── docs/
├── infra/
├── docker-compose.yml
└── package.json
```

## App conventions

- `apps/web` and `apps/admin` use App Router, Tailwind, shadcn/ui, Framer Motion.
- Both call **only** `NEXT_PUBLIC_API_URL` (gateway). No Prisma, no Firebase Admin, no Razorpay secret in the browser.
- Firebase client SDK is used **only** for Auth (getIdToken). Storage uploads go through document-service signed URLs or Cloudinary signed presets issued by the API.

## Service conventions

Each NestJS service:

```
src/
  main.ts
  app.module.ts
  health.controller.ts
  <domain>/
    <domain>.module.ts
    <domain>.controller.ts
    <domain>.service.ts
    dto/
    events/
```

Inter-service calls in MVP: HTTP via internal URLs (`IDENTITY_URL`, etc.). Domain events published on Redis streams (`booking.created`, `payment.captured`, `kyc.approved`). Upgrade to NATS when two services need fan-out retries.

## Database convention (pragmatic microservices)

One PostgreSQL instance, **one Prisma schema** for MVP so joins and migrations stay simple. Each service is still the **only writer** of its tables. Split into database-per-service after the booking path is stable.

## Frontend page map (high level)

See [pages-and-screens.md](pages-and-screens.md).

# Services

NestJS HTTP services. Week 1 they run independently. Gateway becomes the public entry after Firebase token verification is in.

| Folder | Port | First modules to implement |
| --- | ---: | --- |
| gateway | 4000 | Firebase guard, proxy table in `src/proxy.controller.ts` |
| identity-service | 4001 | auth sync, OTP, roles |
| catalog-service | 4002 | car models, search, availability reserve |
| booking-service | 4003 | quotes, bookings, status machine |
| payment-service | 4004 | Razorpay order + webhook |
| document-service | 4005 | KYC, Zoho webhook, Leegality |
| fleet-service | 4006 | cities, branches, vehicles, drivers, inspections |
| partner-service | 4007 | partners, ledger, settlements |
| notification-service | 4008 | Gmail OTP + templates |
| platform-service | 4009 | CMS, CRM, offers, dashboard, reports |

```bash
cd services/identity-service
npx @nestjs/cli start --watch
```

Or from repo root after `npm install`: `npm run dev`.

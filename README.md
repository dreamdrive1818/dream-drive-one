# Dream-Drive MS

Microservice rebuild of the Dream-Drive car rental platform.

**Stack:** Next.js + TypeScript (web + admin) · NestJS microservices · PostgreSQL + Prisma · Firebase Auth · Razorpay · Leegality · Zoho Forms · Expo mobile.

This folder is a **greenfield** codebase. The live product still lives in `client-main` / `backend`. Do not mix Firestore writes into these services.

## How to read this repo

| Audience | Start here |
| --- | --- |
| Client / product | [docs/00-overview.md](docs/00-overview.md) then [docs/modules](docs/modules) |
| Developers | [docs/01-architecture.md](docs/01-architecture.md), [docs/api-routes.md](docs/api-routes.md), Prisma schema |
| Ops | [docs/security-deployment.md](docs/security-deployment.md) |
| Sprint | [docs/sprint-plan.md](docs/sprint-plan.md) |

## Services

| Service | Port | Owns |
| --- | ---: | --- |
| `gateway` | 4000 | Auth verification, routing, rate limits |
| `identity-service` | 4001 | Users, roles, customer profiles |
| `catalog-service` | 4002 | Cars, search, availability, pricing rules |
| `booking-service` | 4003 | All rental types, subscriptions, packages |
| `payment-service` | 4004 | Razorpay, invoices, deposits, wallet |
| `document-service` | 4005 | KYC, Zoho ingest, Leegality, PDFs |
| `fleet-service` | 4006 | Vehicles, maintenance, handover, drivers, cities/branches |
| `partner-service` | 4007 | Partners, commission, settlements |
| `notification-service` | 4008 | Email now, SMS/WhatsApp later |
| `platform-service` | 4009 | CMS, CRM, offers, loyalty, reviews, support, finance reports |

## Apps

| App | Port | Role |
| --- | ---: | --- |
| `apps/api` | 3999 | Legacy health-only process (not the public API) |
| `apps/web` | 3000 | Public site + new booking path (`/fleet`, `/login`, `/account`) |
| `apps/worker` | — | Cron / queue jobs (HOLD sweeper, notify retry) |
| `apps/socket` | 4010 | Socket.IO realtime (booking status) |
| `apps/admin` | 3001 | Operations console |
| `apps/mobile` | — | Expo customer app |

```bash
npm run dev          # gateway + 9 services + worker + web + admin
npm run dev:gateway
npm run dev:web
npm run dev:admin
```

Public API is **gateway** `:4000`. Dev login: `Authorization: Bearer dev:admin@dreamdrive.test` (after seed).

Customer: http://localhost:3000/fleet · Admin: http://localhost:3001/login

`apps/web` still contains the ported marketing site. New booking APIs go through the gateway.

## Local setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

## Branching

```
feature/*  →  PR  →  dev  →  PR  →  staging  →  PR  →  main
                 (development)     (pre-prod)         (production)
```

| Branch | Environment | How it moves |
| --- | --- | --- |
| `dev` | Development | Merge feature PRs here |
| `staging` | Pre-production | Promote `dev` via PR (or Actions → **Promote environment**) |
| `main` | Production | Promote `staging` via PR |

Do not commit to `staging` or `main` directly after this seed. Cut work from `dev`, then promote.

## Out of scope (confirmed)

- Delivery & pickup executive operations
- Partner self-service portal (admin manages partners)

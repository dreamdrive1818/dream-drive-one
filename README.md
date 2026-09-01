# Dream-Drive MS

Modular NestJS API + Next.js web/admin + Expo mobile.

**Stack:** Next.js + TypeScript (web + admin) · NestJS API · PostgreSQL + Prisma · Firebase Auth · Razorpay · Leegality · Zoho Forms · Expo mobile.

This folder is a **greenfield** codebase. The live product still lives in `client-main` / `backend`. Do not mix Firestore writes into these services.

## How to read this repo

| Audience | Start here |
| --- | --- |
| Client / product | [docs/00-overview.md](docs/00-overview.md) then [docs/modules](docs/modules) |
| Developers | [docs/01-architecture.md](docs/01-architecture.md), [docs/api-routes.md](docs/api-routes.md), Prisma schema |
| Ops | [docs/security-deployment.md](docs/security-deployment.md) |
| Sprint | [docs/sprint-plan.md](docs/sprint-plan.md) |

## Apps

| App | Port | Role |
| --- | ---: | --- |
| `apps/api` | 4000 | Public HTTP API (all domain modules) |
| `apps/web` | 3000 | Public site + new booking path (`/fleet`, `/login`, `/account`) |
| `apps/worker` | — | Cron / queue jobs (HOLD sweeper, notify retry) |
| `apps/socket` | 4010 | Socket.IO realtime (booking status) |
| `apps/admin` | 3001 | Operations console |
| `apps/mobile` | — | Expo customer app |

Domain modules live inside `apps/api`: identity, catalog, booking, payment, documents, fleet, partner, notifications, platform.

```bash
npm run dev          # api + worker + web + admin
npm run dev:api
npm run dev:web
npm run dev:admin
```

Public API is **`:4000`**. Dev login: `Authorization: Bearer dev:admin@dreamdrive.test` (after seed).

Customer: http://localhost:3000/fleet · Admin: http://localhost:3001/login

`apps/web` still contains the ported marketing site. New booking APIs go through the API.

## Local setup

Each app has its own `package.json` and `.env`. Copy examples first:

```bash
# one-time per folder (or run scripts/isolate-envs.js)
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/api/.env.example apps/api/.env
cp packages/database/.env.example packages/database/.env

docker compose up -d
cd packages/database && npm install && npm run generate && npm run push && npm run seed
```

Run one app from its folder:

```bash
cd apps/web && npm install && npm run dev
cd apps/admin && npm install && npm run dev
cd apps/api && npm install && npm run dev
```

Or from the repo root (workspaces still work):

```bash
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

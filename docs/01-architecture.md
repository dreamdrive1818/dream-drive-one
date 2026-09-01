# Folder structure

```
dream-drive-MS/
├── apps/
│   ├── api/                    # NestJS HTTP API (port 4000) — all domain modules
│   ├── web/                    # Next.js 15 — public site + customer dashboard
│   ├── admin/                  # Next.js 15 — operations console
│   └── mobile/                 # Expo (React Native) customer app
├── packages/
│   ├── database/               # Prisma schema + migrations
│   ├── shared-types/           # DTOs, enums, events
│   └── config/                 # env helpers
├── docs/
├── infra/
├── docker-compose.yml
└── package.json
```

## App conventions

- `apps/web` and `apps/admin` use App Router, Tailwind, shadcn/ui, Framer Motion.
- Both call **only** `NEXT_PUBLIC_API_URL` (the API on :4000). No Prisma, no Firebase Admin, no Razorpay secret in the browser.
- Firebase client SDK is used **only** for Auth (getIdToken). Storage uploads go through signed URLs or Cloudinary signed presets issued by the API.

## API conventions

One NestJS process. Domain code is grouped by folder under `apps/api/src/modules/` (identity, catalog, booking, payment, documents, fleet, partner, notifications, platform).

Internal routes `/internal/*` require `x-internal-token`. The worker calls those on `API_URL` (same port 4000).

## Database convention

One PostgreSQL instance, **one Prisma schema**.

## Frontend page map (high level)

See [pages-and-screens.md](pages-and-screens.md).

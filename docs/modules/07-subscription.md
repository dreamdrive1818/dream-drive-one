# 7. Car subscription & long-term rentals

**Status: ✅ Implemented**

## Feature purpose

Monthly/quarterly car use with a different price, deposit, and swap policy than daily rental.

## Customer-side actions

- Choose tenure (1 / 3 / 6 / 12 months)
- See included km, maintenance responsibility
- Book → KYC → e-sign subscription agreement
- Request swap / early close (policy)

## Admin-side actions

- Define plans per car model (CRUD)
- Approve swap, charge extra km
- Pause / resume / close subscription
- View invoice schedule per subscription

## Backend APIs

### Public
- `GET  /v1/public/subscriptions/plans` — list active plans with car details
- `POST /v1/subscriptions` — create subscription (customer)

### Admin — Plans
- `GET    /v1/admin/subscriptions/plans` — list all plans (with subscription count)
- `POST   /v1/admin/subscriptions/plans` — create plan
- `PATCH  /v1/admin/subscriptions/plans/:id` — update plan
- `POST   /v1/admin/subscriptions/plans/:id/delete` — soft-delete (deactivate)

### Admin — Lifecycle
- `GET    /v1/admin/subscriptions` — list all subscriptions (filterable by status)
- `GET    /v1/admin/subscriptions/:id` — get subscription detail + invoice schedule
- `POST   /v1/admin/subscriptions/:id/swap` — swap vehicle (body: `{ vehicleId }`)
- `POST   /v1/admin/subscriptions/:id/close` — early close (body: `{ reason? }`)
- `POST   /v1/admin/subscriptions/:id/pause` — pause subscription
- `POST   /v1/admin/subscriptions/:id/resume` — resume paused subscription

## Database

| Model | Status |
|---|---|
| `SubscriptionPlan` | ✅ Enhanced — added `depositPaise`, `maintenanceIncl`, `swapAllowed`, `active`, timestamps, `carModel` relation |
| `Subscription` | ✅ Enhanced — added `status` (ACTIVE/PAUSED/CLOSED/COMPLETED), `swapCount`, `extraKmPaise`, `pausedAt`, `earlyCloseAt`, `closedReason`, timestamps |
| `SubscriptionInvoiceSchedule` | ✅ New — auto-generated monthly schedule on subscription creation |
| `SubscriptionStatus` enum | ✅ New |

Implemented **inside booking-service** (`rentalType = SUBSCRIPTION`) plus a plan table in catalog.

## Validations

- Tenure start aligned to handover date
- Recurring Razorpay mandate optional later; MVP is invoice-per-month with payment link
- Cannot overlap with short-term booking of same vehicle
- Swap only allowed if plan has `swapAllowed = true`
- Pause/resume only for ACTIVE/PAUSED subscriptions respectively

## RBAC

Same as booking. FINANCE owns recurring invoices.
- Plan CRUD: SALES, FINANCE, SUPER_ADMIN
- Swap: FLEET_OPS, CITY_MANAGER, SUPER_ADMIN
- Close: SALES, FINANCE, CITY_MANAGER, SUPER_ADMIN
- Pause/Resume: FLEET_OPS, CITY_MANAGER, SUPER_ADMIN

## Gateway routing

`/v1/subscriptions`, `/v1/public/subscriptions`, `/v1/admin/subscriptions` → booking-service ✅

## Business benefit

Higher LTV inventory utilization.

## Priority / complexity

**P2 — after daily booking path. Complexity: M.**

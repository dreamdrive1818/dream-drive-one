# API route structure

All public/admin traffic hits **gateway** `http://localhost:4000`. Prefix `/v1`.

Webhooks are unauthenticated except HMAC. Internal routes `/internal/*` require a service token and are not exposed on the public gateway in production (private network).

## Gateway

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Aggregated |
| * | `/v1/**` | JWT unless listed public |

Public (no user token): search, car detail, CMS, contact/leads, auth OTP, webhooks.

## Identity `:4001`

```
POST /v1/auth/sync
POST /v1/auth/otp/send
POST /v1/auth/otp/verify
GET  /v1/me
PATCH /v1/me
POST /v1/me/devices
GET  /v1/admin/users
PATCH /v1/admin/users/:id/roles
POST /v1/admin/users/:id/disable
GET  /v1/admin/audit
```

## Catalog `:4002`

```
GET  /v1/public/search
GET  /v1/public/cars/:slug
GET  /v1/public/cars/:id/availability
CRUD /v1/admin/car-models
CRUD /v1/admin/pricing-rules
POST /internal/availability/reserve
POST /internal/availability/release
```

## Booking `:4003`

```
POST /v1/quotes
POST /v1/quotes/:id/apply-offer
POST /v1/bookings
GET  /v1/bookings/:id
GET  /v1/me/bookings
POST /v1/bookings/:id/cancel
PATCH /v1/admin/bookings/:id
POST /v1/admin/bookings/:id/status
POST /v1/admin/bookings/:id/assign-vehicle
POST /v1/admin/bookings/:id/assign-driver
POST /v1/subscriptions
GET  /v1/public/packages
CRUD /v1/admin/packages
CRUD /v1/admin/city-pairs
```

## Payment `:4004`

```
POST /v1/payments/orders
POST /v1/payments/verify
POST /v1/webhooks/razorpay
GET  /v1/me/invoices
GET  /v1/me/wallet
POST /v1/admin/payments/offline
POST /v1/admin/payments/:id/refund
POST /v1/admin/deposits/:id/capture
POST /v1/admin/deposits/:id/release
```

## Document `:4005`

```
POST /v1/kyc/uploads
POST /v1/kyc/submit
GET  /v1/me/kyc
GET  /v1/admin/kyc
POST /v1/admin/kyc/:id/decision
POST /v1/webhooks/zoho-form
POST /v1/agreements/generate
POST /v1/agreements/:id/send-leegality
POST /v1/webhooks/leegality
GET  /v1/me/agreements/:id
```

## Fleet `:4006`

```
CRUD /v1/admin/cities
CRUD /v1/admin/branches
CRUD /v1/admin/vehicles
CRUD /v1/admin/drivers
CRUD /v1/admin/maintenance-jobs
POST /v1/admin/bookings/:id/handover
POST /v1/admin/bookings/:id/return
GET  /v1/admin/vehicles/expiries
```

## Partner `:4007`

```
CRUD /v1/admin/partners
PUT  /v1/admin/partners/:id/commission-rules
POST /v1/admin/settlements/generate
POST /v1/admin/settlements/:id/mark-paid
GET  /v1/admin/partners/:id/ledger
```

## Notification `:4008`

```
POST /internal/notify
GET  /v1/admin/notifications
PUT  /v1/admin/notification-templates/:key
```

## Platform `:4009`

```
GET  /v1/public/pages/:slug
GET  /v1/public/banners
GET  /v1/public/blogs
POST /v1/public/contact
POST /v1/public/leads
CRUD /v1/admin/cms/*
CRUD /v1/admin/offers
CRUD /v1/admin/tickets
GET  /v1/admin/dashboard
GET  /v1/admin/reports/*
POST /v1/reviews
GET  /v1/admin/leads
```

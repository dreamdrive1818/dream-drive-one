# API route structure

All public/admin traffic hits **`apps/api`** `http://localhost:4000`. Prefix `/v1`.

Webhooks are unauthenticated except HMAC. Internal routes `/internal/*` require a service token.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Process health |
| * | `/v1/**` | JWT unless listed public |

Public (no user token): search, car detail, CMS, contact/leads, auth OTP, webhooks.

## Identity

```
POST /v1/auth/sync
POST /v1/auth/login
POST /v1/auth/register
POST /v1/auth/google
POST /v1/auth/otp/send
POST /v1/auth/otp/verify
GET  /v1/me
PATCH /v1/me
POST /v1/me/phone/verify
POST /v1/me/addresses
PATCH /v1/me/addresses/:id
DELETE /v1/me/addresses/:id
GET  /v1/me/dashboard
POST /v1/me/devices
GET  /v1/me/bookings
GET  /v1/me/documents
GET  /v1/me/agreements
GET  /v1/me/invoices
GET  /v1/me/tickets
POST /v1/me/tickets
GET  /v1/admin/users
GET  /v1/admin/customers/:id
POST /v1/admin/customers/:id/notes
PATCH /v1/admin/customers/:id
POST /v1/admin/users/invite
PATCH /v1/admin/users/:id/roles
PUT  /v1/admin/staff/:id/scope
POST /v1/admin/users/:id/disable
GET  /v1/admin/audit
```

## Catalog

```
GET  /v1/public/search
GET  /v1/public/cars/:slug
GET  /v1/public/cars/:id/availability
GET  /v1/public/catalog-config
CRUD /v1/admin/car-models
CRUD /v1/admin/pricing-rules
GET/PUT /v1/admin/catalog-settings
CRUD /v1/admin/availability-blocks
POST /internal/availability/reserve
POST /internal/availability/release
```

## Booking

```
POST /v1/quotes
GET  /v1/quotes/:id
POST /v1/quotes/:id/apply-offer
POST /v1/bookings
GET  /v1/bookings/:id
GET  /v1/me/bookings
POST /v1/bookings/:id/cancel
POST /v1/public/bookings/track/otp
POST /v1/public/bookings/track/verify
GET  /v1/admin/bookings
POST /v1/admin/bookings
PATCH /v1/admin/bookings/:id
POST /v1/admin/bookings/:id/status
POST /v1/admin/bookings/:id/assign-vehicle
POST /v1/admin/bookings/:id/assign-driver
POST /v1/subscriptions
GET  /v1/public/packages
GET  /v1/public/packages/:slug
GET  /v1/public/city-pairs
CRUD /v1/admin/packages
CRUD /v1/admin/city-pairs
GET  /v1/admin/trip-extras
POST /v1/admin/bookings/:id/extras
POST /internal/holds/expire
POST /internal/bookings/mark-no-show
```

## Payment

```
POST /v1/payments/orders
POST /v1/payments/verify
POST /v1/webhooks/razorpay
GET  /v1/me/invoices
GET  /v1/me/invoices/:id
GET  /v1/me/wallet
POST /v1/admin/payments/offline
POST /v1/admin/payments/:id/refund
POST /v1/admin/deposits/:id/capture
POST /v1/admin/deposits/:id/release
```

## Document

```
POST /v1/uploads
POST /v1/public/uploads
POST /v1/kyc/uploads
POST /v1/kyc/submit
GET  /v1/me/kyc
GET  /v1/me/documents
GET  /v1/me/agreements
GET  /v1/me/agreements/:id
GET  /v1/admin/kyc
POST /v1/admin/kyc/:id/review
POST /v1/admin/kyc/:id/request-reupload
POST /v1/admin/kyc/:id/decision
POST /v1/admin/kyc/:id/reset
POST /v1/webhooks/zoho-form
POST /internal/kyc/apply-reusable
POST /v1/agreements/generate
POST /v1/agreements/:id/send-leegality
POST /v1/webhooks/leegality
```

## Fleet

```
CRUD /v1/admin/cities
GET  /v1/admin/cities/:id
CRUD /v1/admin/branches
GET  /v1/admin/branches/:id
CRUD /v1/admin/vehicles
CRUD /v1/admin/drivers
GET  /v1/admin/drivers/availability
POST /v1/admin/drivers/:id/documents
PATCH /v1/admin/drivers/:id/documents/:docId
DELETE /v1/admin/drivers/:id/documents/:docId
POST /v1/admin/drivers/:id/leave
PATCH /v1/admin/drivers/:id/leave/:leaveId
DELETE /v1/admin/drivers/:id/leave/:leaveId
CRUD /v1/admin/workshops
CRUD /v1/admin/maintenance-jobs
POST /v1/admin/maintenance-jobs/:id/complete
POST /v1/admin/maintenance-jobs/:id/cancel
GET  /v1/public/airports
CRUD /v1/admin/airports
POST /v1/admin/bookings/:id/handover
POST /v1/admin/bookings/:id/return
GET  /v1/admin/inspections
GET  /v1/admin/inspections/:id
POST /v1/admin/inspections/:id/damages
POST /v1/admin/inspections/:id/close
GET  /v1/admin/vehicles/expiries
```

## Partner

```
CRUD /v1/admin/partners
GET  /v1/admin/partners/:id
POST /v1/admin/partners/:id/contracts
PATCH /v1/admin/partners/:id/contracts/:contractId
DELETE /v1/admin/partners/:id/contracts/:contractId
POST /v1/admin/partners/:id/vehicles
DELETE /v1/admin/partners/:id/vehicles/:vehicleId
PUT  /v1/admin/partners/:id/commission-rules
GET  /v1/admin/partners/:id/ledger
POST /v1/admin/partners/:id/ledger/adjust
GET  /v1/admin/settlements
GET  /v1/admin/settlements/:id
POST /v1/admin/settlements/generate
POST /v1/admin/settlements/:id/mark-paid
POST /v1/admin/settlements/:id/release-hold
POST /internal/ledger/trip-complete
POST /internal/settlements/generate-weekly
```

## Notification

```
POST /internal/notify
GET  /v1/admin/notifications
PUT  /v1/admin/notification-templates/:key
```

## Platform

```
GET  /v1/public/pages/:slug
GET  /v1/public/banners
GET  /v1/public/blogs
POST /v1/public/contact
POST /v1/public/leads
CRUD /v1/admin/cms/*
CRUD /v1/admin/offers
GET  /v1/me/tickets
POST /v1/me/tickets
POST /v1/me/tickets/:id/messages
CRUD /v1/admin/tickets
GET  /v1/admin/dashboard
GET  /v1/admin/reports/*
POST /v1/reviews
GET  /v1/admin/leads
```

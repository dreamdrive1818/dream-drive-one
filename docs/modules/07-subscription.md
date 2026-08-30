# 7. Car subscription & long-term rentals

## Feature purpose

Monthly/quarterly car use with a different price, deposit, and swap policy than daily rental.

## Customer-side actions

- Choose tenure (1 / 3 / 6 / 12 months)
- See included km, maintenance responsibility
- Book → KYC → e-sign subscription agreement
- Request swap / early close (policy)

## Admin-side actions

- Define plans per car model
- Approve swap, charge extra km
- Pause for workshop

## Backend APIs

`GET /v1/public/subscriptions/plans`  
`POST /v1/subscriptions`  
`POST /v1/admin/subscriptions/:id/swap`  
`POST /v1/admin/subscriptions/:id/close`

## Database

`SubscriptionPlan`, `Subscription`, `SubscriptionInvoiceSchedule`

Implemented **inside booking-service** (`rentalType = SUBSCRIPTION`) plus a plan table in catalog.

## Validations

- Tenure start aligned to handover date
- Recurring Razorpay mandate optional later; MVP is invoice-per-month with payment link
- Cannot overlap with short-term booking of same vehicle

## RBAC

Same as booking. FINANCE owns recurring invoices.

## Business benefit

Higher LTV inventory utilization.

## Priority / complexity

**P2 — after daily booking path. Complexity: M.**

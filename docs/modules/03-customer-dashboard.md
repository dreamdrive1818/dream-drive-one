# 3. Customer accounts & web dashboard

## Feature purpose

Logged-in area: profile, bookings, KYC status, payments, documents, support tickets.

## Customer-side actions

- View / edit profile and addresses
- List bookings and open tracking
- See KYC and agreement status
- Download invoices
- Open a support ticket

## Admin-side actions

- Impersonation is **not** allowed. Support views the same data read-only
- Reset KYC request, add internal note

## Backend APIs

| Method | Route |
| --- | --- |
| GET/PATCH | `/v1/me` |
| GET | `/v1/me/bookings` |
| GET | `/v1/me/documents` |
| GET | `/v1/me/invoices` |
| GET/POST | `/v1/me/tickets` |

Gateway aggregates booking + payment + document calls; web dashboard does not stitch three tokens.

## Database

Uses `User`, `CustomerProfile`, `Address` plus reads from booking/payment/document services.

## Validations

- Customer can only read own `userId`
- Phone change re-triggers OTP
- Profile name must match KYC once KYC is APPROVED (admin override)

## RBAC

CUSTOMER own data. SUPPORT/SALES read any customer.

## Business benefit

Replaces localStorage “order” + Firestore user docs with a real account.

## Priority / complexity

**P0. Complexity: S.**

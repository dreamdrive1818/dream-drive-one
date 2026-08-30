# 20. Notification suite

## Feature purpose

Transactional messages. Email in MVP (Gmail OAuth, already in production). SMS/WhatsApp later via same templates.

## Customer-side actions

- Receive OTP, booking confirmation, payment receipt, KYC decision, Leegality invite, reminder before trip, cancellation

## Admin-side actions

- Edit templates
- Resend
- See delivery log

## Backend APIs

`POST /v1/internal/notify` (services only)  
`GET /v1/admin/notifications`  
`PUT /v1/admin/notification-templates/:key`  
Public: `POST /v1/auth/otp/send` `POST /v1/auth/otp/verify` (gateway → identity → notification)

## Database

`NotificationTemplate`, `NotificationLog`  
OTP codes live in **Redis** (5 min TTL) — same as current backend.

## Validations

- Template keys immutable
- PII not logged in full (mask email/phone)
- Rate limit OTP 3 / 15 min / email
- Failures retry 3x with backoff

## RBAC

Internal service token for `/internal/notify`. Admin: SUPER_ADMIN.

## Business benefit

Decouples Gmail outages from booking writes.

## Priority / complexity

**P0 OTP + confirmation. P1 rest. Complexity: S.**

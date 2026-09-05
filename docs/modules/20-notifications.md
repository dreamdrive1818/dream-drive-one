# 20. Notification suite

## Feature purpose

Transactional messages. Email in MVP (Gmail OAuth, already in production). SMS/WhatsApp later via same templates.

## Customer-side actions

- Receive OTP, booking confirmation, payment receipt, KYC decision, Leegality invite, reminder before trip, cancellation

## Admin-side actions

- Edit templates (keys immutable)
- Resend
- See delivery log (email/phone masked)

## Backend APIs

`POST /internal/notify` (services only)  
`POST /internal/notify/retry`  
`POST /internal/notify/reminders`  
`GET /v1/admin/notifications`  
`POST /v1/admin/notifications/:id/resend`  
`GET /v1/admin/notification-templates`  
`PUT /v1/admin/notification-templates/:key`  
Public: `POST /v1/auth/otp/send` `POST /v1/auth/otp/verify` (gateway → identity → notification)

## Database

`NotificationTemplate`, `NotificationLog` (stores rendered subject/body for retry; `attempts`, `nextRetryAt`, `ref`)  
OTP codes live hashed in **Postgres** (5 min TTL, memory fallback) — same as module 01. Spec Redis is not required for send.

## Validations

- Template keys immutable (URL key is the identity; admin cannot rename)
- PII not returned in full on GET logs (mask email/phone; redact OTP digits)
- Rate limit OTP 3 / 15 min / email + IP
- Failures retry 3x with 5 / 15 / 45 min backoff
- HTML templates sent as HTML (not wrapped in `<pre>`)
- Console mock when `GMAIL_USER` is unset

## RBAC

Internal service token for `/internal/notify`. Logs: SUPER_ADMIN + SUPPORT. Templates + resend: SUPER_ADMIN.

## Business benefit

Decouples Gmail outages from booking writes.

## Priority / complexity

**P0 OTP + confirmation. P1 rest. Complexity: S.**

# 10. Rental agreement, e-signature & automated PDF

## Feature purpose

Generate a booking-specific rental agreement PDF and get it legally signed via Leegality. No handover of self-drive cars without a completed signature.

## Customer-side actions

- Review agreement
- Sign on Leegality (email/SMS link)
- Download draft and signed PDF (`GET /v1/me/agreements/:id/pdf` and `/signed-pdf`)

## Admin-side actions

- Edit clause templates by city / product (`/v1/admin/agreement-templates`)
- Void and re-issue (`POST /v1/admin/agreements/:id/void`)
- Upload wet-ink scan fallback (`POST /v1/admin/agreements/:id/mark-signed`)
- See envelope status (`GET /v1/admin/agreements`, admin `/agreements`)

## Backend APIs

| Method | Route |
| --- | --- |
| POST | `/v1/agreements/generate` |
| POST | `/v1/agreements/:id/send-leegality` |
| POST | `/v1/webhooks/leegality` |
| GET | `/v1/me/agreements/:id` |
| GET | `/v1/me/agreements/:id/pdf` |
| GET | `/v1/me/agreements/:id/signed-pdf` |
| POST | `/v1/admin/agreements/:id/mark-signed` |
| POST | `/v1/admin/agreements/:id/void` |
| GET | `/v1/admin/agreements` |
| GET/POST/PATCH/DELETE | `/v1/admin/agreement-templates` |

PDF generation: NestJS Helvetica PDF (same approach as invoices) from HTML template placeholders. Fields: parties, vehicle, dates, tariff, deposit, damage clauses, city jurisdiction.

Live Leegality: `POST {LEEGALITY_BASE_URL}/v3.0/sign/request` with `profileId`, base64 PDF, and invitee email matching the customer. Without `LEEGALITY_API_KEY` + `LEEGALITY_PROFILE_ID` the send path mocks an envelope.

Webhook: HMAC-SHA1 `mac` over `documentId` using `LEEGALITY_PRIVATE_SALT` (required in production). Optional `LEEGALITY_IP_ALLOWLIST`. On Completed, pull signed file via Document Details and store a `SignedArtifact`.

## Database

`AgreementTemplate` (city + rentalType + active), `Agreement` (htmlSnapshot, void fields, re-issue pointer), `SignatureEnvelope`, `SignedArtifact`

## Validations

- Generate only after booking exists and KYC is APPROVED (self-drive)
- Leegality invite email must match customer email
- Webhook signature / IP allowlist
- Status CONFIRMED requires envelope COMPLETED unless admin waiver
- Void is SUPER_ADMIN only; waiver is SUPPORT + SUPER_ADMIN

## RBAC

CUSTOMER: own. SALES: generate/send. SUPER_ADMIN: void/waiver. FINANCE: read.

## Business benefit

Replaces the current “sign consent form” URL with an auditable legal trail.

## Priority / complexity

**P0 after KYC. Complexity: M–L** (vendor integration).

# 10. Rental agreement, e-signature & automated PDF

## Feature purpose

Generate a booking-specific rental agreement PDF and get it legally signed via Leegality. No handover of self-drive cars without a completed signature.

## Customer-side actions

- Review agreement
- Sign on Leegality (email/SMS link)
- Download signed PDF

## Admin-side actions

- Edit clause templates by city / product
- Void and re-issue
- Upload wet-ink scan fallback
- See envelope status

## Backend APIs

| Method | Route |
| --- | --- |
| POST | `/v1/agreements/generate` |
| POST | `/v1/agreements/:id/send-leegality` |
| POST | `/v1/webhooks/leegality` |
| GET | `/v1/me/agreements/:id` |
| POST | `/v1/admin/agreements/:id/void` |

PDF generation: NestJS + template (PDFKit or HTML→PDF). Fields: parties, vehicle, dates, tariff, deposit, damage clauses, city jurisdiction.

## Database

`AgreementTemplate`, `Agreement`, `SignatureEnvelope`, `SignedArtifact`

## Validations

- Generate only after booking exists and KYC is APPROVED (self-drive)
- Leegality invite email must match customer email
- Webhook signature / IP allowlist
- Status CONFIRMED requires envelope COMPLETED unless admin waiver

## RBAC

CUSTOMER: own. SALES: send. SUPER_ADMIN: void/waiver. FINANCE: read.

## Business benefit

Replaces the current “sign consent form” URL with an auditable legal trail.

## Priority / complexity

**P0 after KYC. Complexity: M–L** (vendor integration).

# 9. Legal KYC & online document management

## Feature purpose

Collect and verify identity documents before self-drive handover. Store files in Cloudinary/S3/Firebase Storage via **server-issued** upload slots.

## Customer-side actions

- Upload Aadhaar, PAN, driving licence, selfie, address proof
- Track KYC: NOT_STARTED → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED
- Re-upload if rejected

## Admin-side actions

- Review queue
- Approve / reject with reason
- Request re-upload of a specific doc
- Flag expiry of DL

## Backend APIs

| Method | Route |
| --- | --- |
| POST | `/v1/kyc/uploads` (signed upload) |
| POST | `/v1/kyc/submit` |
| GET | `/v1/me/kyc` |
| GET | `/v1/admin/kyc` |
| POST | `/v1/admin/kyc/:id/decision` |
| POST | `/v1/webhooks/zoho-form` |

Zoho Forms remain an **alternate ingest** (current production path). Webhook upserts a `KycCase` + `ZohoSubmission` and attaches files (existing Cloudinary/Zoho attachment flow).

## Database

`KycCase`, `KycDocument`, `ZohoSubmission`

## Validations

- File type pdf/jpg/png/webp; max size
- DL expiry must be after planned drop-off
- Aadhaar number stored hashed + last4 only (do not log raw)
- Approved KYC reusable for 12 months unless docs expire

## RBAC

CUSTOMER: own. SUPPORT/SALES: view. SUPER_ADMIN + designated KYC role: decide.

## Business benefit

Unifies Firestore `form_entries` and in-app uploads into one compliance file.

## Priority / complexity

**P0 (needed before self-drive handover). Complexity: M.**

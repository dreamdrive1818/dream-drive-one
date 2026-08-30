# 21. Leads, enquiries & sales CRM

## Feature purpose

Capture website/mobile enquiries and missed bookings into a pipeline. Replaces ad-hoc Firestore `contacts`.

## Customer-side actions

- Submit contact / “request a callback”
- WhatsApp click is tracked as a lead source

## Admin-side actions

- Pipeline: NEW → CONTACTED → QUALIFIED → BOOKED / LOST
- Assign owner, reminders
- Convert lead → booking (prefill quote)
- Source: web, Zoho, ads, referral, walk-in

## Backend APIs

`POST /v1/public/leads`  
`GET /v1/admin/leads`  
`PATCH /v1/admin/leads/:id`  
`POST /v1/admin/leads/:id/convert`

## Database

`Lead`, `LeadActivity`

## Validations

- Phone or email required
- Deduplicate by phone+email within 7 days
- Convert requires city + dates

## RBAC

SALES, SUPPORT, CITY_MANAGER, SUPER_ADMIN.

## Business benefit

Sales can follow up instead of losing form dumps.

## Priority / complexity

**P1. Complexity: S.**

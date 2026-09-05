# 21. Leads, enquiries & sales CRM

## Feature purpose

Capture website/mobile enquiries and missed bookings into a pipeline. Replaces ad-hoc Firestore `contacts`.

## Customer-side actions

- Submit contact / “request a callback” on `/contact` (`POST /v1/public/contact`) — phone **or** email required; city optional
- WhatsApp / call click is tracked as a lead source (`source=whatsapp` / `phone`) without storing the business number as the customer
- Duplicate enquiries with the same phone or email within 7 days attach a note instead of creating a new lead

## Admin-side actions

- Pipeline: NEW → CONTACTED → QUALIFIED → BOOKED / LOST on `/leads`
- Assign owner, follow-up reminder (hourly worker emails the owner)
- Convert lead → quote + HOLD booking (prefill city + dates; requires a car)
- Source: web, contact, whatsapp, phone, zoho, ads, referral, walk-in

## Backend APIs

`POST /v1/public/leads`  
`POST /v1/public/contact`  
`GET /v1/admin/leads` — `status`, `source`, `assignedToId`, `reminderDue`, `q`  
`GET /v1/admin/leads/:id`  
`PATCH /v1/admin/leads/:id` — status, owner, remindAt, city, contact fields  
`POST /v1/admin/leads/:id/notes`  
`POST /v1/admin/leads/:id/convert` — `{ city, startsAt, endsAt, carModelId, rentalType? }`  
`POST /internal/notify/reminders` also sends due lead follow-ups

Implemented in **apps/api** platform module (public capture in CMS; convert uses booking engine). Zoho KYC webhook also upserts a `source=zoho` lead.

## Database

`Lead` (assignedTo, remindAt, bookingId)  
`LeadActivity`

## Validations

- Phone or email required (except WhatsApp/call click tracking)
- Deduplicate by phone or email within 7 days
- Convert requires city + dates + carModelId; lead must have email or phone
- Convert owner must be SALES / SUPPORT / CITY_MANAGER / SUPER_ADMIN

## RBAC

SALES, SUPPORT, CITY_MANAGER, SUPER_ADMIN. Convert is SALES / CITY_MANAGER / SUPER_ADMIN.

## Business benefit

Sales can follow up instead of losing form dumps.

## Priority / complexity

**P1. Complexity: S.**

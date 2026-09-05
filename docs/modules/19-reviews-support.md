# 19. Reviews & customer support desk

## Feature purpose

Post-trip reviews on cars; ticketed support instead of only WhatsApp.

## Customer-side actions

- After COMPLETED: rate 1–5 + text on `/account/bookings/:id`
- Open ticket, reply, attach image on `/account/tickets`
- See ticket status (internal staff notes stay hidden)

## Admin-side actions

- Moderate reviews (publish/hide) on `/reviews` — SUPER_ADMIN
- Ticket queue with status filter, assign, internal notes, SLA overdue
- Link ticket to booking (create or PATCH)

## Backend APIs

`POST /v1/reviews` — COMPLETED booking, one per booking, rating 1–5; abuse keywords flag for moderation, never auto-publish  
`GET /v1/me/reviews`  
`GET /v1/public/cars/:id/reviews` — published only (id or slug)  
`PATCH /v1/admin/reviews/:id` — `{ published }` SUPER_ADMIN  
`GET /v1/admin/reviews`  
`GET/POST /v1/me/tickets`  
`GET/PATCH /v1/me/tickets/:id` — customer close  
`POST /v1/me/tickets/:id/messages` — optional `imageUrl`  
`GET /v1/admin/tickets` — `status`, `assignedToId`, `overdue`  
`GET/PATCH /v1/admin/tickets/:id` — status, assign, SLA, booking link (SUPPORT)  
`POST /v1/admin/tickets/:id/messages` — SALES comment; SUPPORT internal notes

Images upload via `POST /v1/uploads` folder `tickets`. Default first-response SLA is 24h (`TICKET_SLA_HOURS`).

Implemented in **apps/api** platform module (mirrored in platform-service).

## Database

`Review` (flagged, published, unique bookingId)  
`Ticket` (assignedTo, slaDueAt, firstRespondedAt)  
`TicketMessage` (authorId, imageUrl, internal)

## Validations

- One review per booking
- Only COMPLETED bookings
- Abuse keywords → moderation queue (`flagged`, unpublished)
- Customer cannot see internal notes

## RBAC

SUPPORT owns tickets (assign/status/SLA/internal notes). SALES can comment. SUPER_ADMIN publish reviews.

## Business benefit

Public proof + a queue you can measure.

## Priority / complexity

**P2. Complexity: S–M.**

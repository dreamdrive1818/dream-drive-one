# 19. Reviews & customer support desk

## Feature purpose

Post-trip reviews on cars; ticketed support instead of only WhatsApp.

## Customer-side actions

- After COMPLETED: rate 1–5 + text
- Open ticket, reply, attach image
- See ticket status

## Admin-side actions

- Moderate reviews (publish/hide)
- Ticket queue, assign, internal notes, SLA
- Link ticket to booking

## Backend APIs

`POST /v1/reviews`  
`GET /v1/public/cars/:id/reviews`  
`CRUD /v1/me/tickets`  
`PATCH /v1/admin/tickets/:id`

## Database

`Review`, `Ticket`, `TicketMessage`

## Validations

- One review per booking
- Only COMPLETED bookings
- Abuse keywords → moderation queue
- Customer cannot see internal notes

## RBAC

SUPPORT owns tickets. SALES can comment. SUPER_ADMIN publish reviews.

## Business benefit

Public proof + a queue you can measure.

## Priority / complexity

**P2. Complexity: S–M.**

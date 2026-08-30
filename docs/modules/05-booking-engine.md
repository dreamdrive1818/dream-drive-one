# 5. Booking engine — all rental types

## Feature purpose

Create and progress a booking through its lifecycle for every rental product Dream-Drive sells.

## Rental types (MVP + later)

| Type | MVP | Notes |
| --- | --- | --- |
| SELF_DRIVE | Yes | Current site |
| WITH_DRIVER_LOCAL | Yes | Hours / km package |
| WITH_DRIVER_INTERCITY | Yes | One-way or round trip |
| AIRPORT | Week 4+ | Pickup/drop terminal |
| OUTSTATION | With intercity | Extra km, driver allowance |
| ONE_WAY | With intercity | One-way fee, different drop branch |
| TOUR_PACKAGE | Later | Fixed itinerary |
| SUBSCRIPTION | Later | See module 7 |

## Customer-side actions

- Select car + type + dates/times + pickup/drop
- Apply offer code
- Confirm quote → HOLD → pay token
- Cancel within policy
- Track status

## Admin-side actions

- Create booking on behalf of customer
- Change car / dates (re-quote)
- Assign vehicle + driver
- Move status (confirmed → handover → ongoing → return → closed)
- Force cancel with reason

## Backend APIs

| Method | Route |
| --- | --- |
| POST | `/v1/quotes` |
| POST | `/v1/bookings` |
| GET | `/v1/bookings/:id` |
| POST | `/v1/bookings/:id/cancel` |
| PATCH | `/v1/admin/bookings/:id` |
| POST | `/v1/admin/bookings/:id/assign-vehicle` |
| POST | `/v1/admin/bookings/:id/assign-driver` |
| POST | `/v1/admin/bookings/:id/status` |

## Database

`Quote`, `Booking`, `BookingStatusHistory`, `BookingExtra`, `AssignedVehicle`, `AssignedDriver`

Statuses: `DRAFT`, `HOLD`, `AWAITING_PAYMENT`, `AWAITING_KYC`, `AWAITING_SIGNATURE`, `CONFIRMED`, `HANDOVER`, `ONGOING`, `RETURN_PENDING`, `COMPLETED`, `CANCELLED`, `NO_SHOW`

## Validations

- Quote TTL 15–30 min; price frozen on HOLD
- Cannot confirm without token payment (except admin-comped)
- Self-drive requires KYC + signed agreement before handover
- With-driver may skip customer DL but still needs ID
- Overlap check must run in a transaction with vehicle lock
- Cancellation policy by product + hours-before-start

## RBAC

CUSTOMER: own bookings. SALES/SUPPORT: create/assist. FLEET_OPS: assign vehicle/driver and handover. FINANCE: refunds. CITY/BRANCH managers: scoped.

## Business benefit

Single source of truth instead of Firestore `orders` + Zoho `form_entries` that can diverge.

## Priority / complexity

**P0. Complexity: L.**

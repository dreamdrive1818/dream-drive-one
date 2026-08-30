# 14. Driver & chauffeur management

## Feature purpose

Pool of chauffeurs for WITH_DRIVER products: documents, shifts, assignment to bookings.

## Customer-side actions

- See driver name/phone after assignment (not at search time)

## Admin-side actions

- CRUD drivers, DL, badge, city/branch
- Set availability / leave
- Assign to booking
- No customer-facing driver marketplace

## Backend APIs

`CRUD /v1/admin/drivers`  
`POST /v1/admin/bookings/:id/assign-driver`  
`GET /v1/admin/drivers/availability`

## Database

`Driver`, `DriverDocument`, `DriverAssignment`, `DriverLeave`

## Validations

- DL valid through trip end
- One ONGOING assignment per driver
- Driver city must match booking city (override by CITY_MANAGER)

## RBAC

FLEET_OPS, BRANCH_MANAGER, CITY_MANAGER.

## Business benefit

Stops assigning chauffeurs in chat.

## Priority / complexity

**P1 with with-driver bookings. Complexity: S–M.**

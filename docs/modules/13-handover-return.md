# 13. Handover & return inspection

## Feature purpose

Checklist + photos at start and end of rental. Drives deposit release and damage charges.

## Customer-side actions

- Acknowledge handover checklist on phone (optional later)
- See damage charges on invoice

## Admin-side actions (branch staff, not a delivery-exec app)

- Start handover: fuel, odometer, photos, accessories, customer signature
- Start return: same + damage items
- Raise penalty extras → payment-service

**Out of scope:** dedicated pickup/delivery executive operations.

## Backend APIs

`POST /v1/admin/bookings/:id/handover`  
`POST /v1/admin/bookings/:id/return`  
`POST /v1/admin/inspections/:id/damages`

## Database

`Inspection`, `InspectionPhoto`, `InspectionItem`, `DamageCharge`

## Validations

- Handover only from CONFIRMED with signed agreement (self-drive)
- Return odometer >= handover odometer
- Fuel unit consistent
- Deposit release event only when return CLOSED and no open damages

## RBAC

FLEET_OPS, BRANCH_MANAGER.

## Business benefit

Turns disputes into a photo log.

## Priority / complexity

**P1 after live bookings. Complexity: M.**

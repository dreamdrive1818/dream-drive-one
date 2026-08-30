# 11. Vehicle & fleet management

## Feature purpose

Track physical cars (registration, branch, odometer, owner = company or partner), distinct from the marketing `CarModel` customers browse.

## Customer-side actions

- None directly (they see model + maybe plate after assignment)

## Admin-side actions

- CRUD vehicles, documents (RC, insurance, PUC, permit) with expiry alerts
- Move vehicle between branches
- Set status: AVAILABLE, ON_TRIP, MAINTENANCE, BLOCKED, SOLD
- Attach to partner

## Backend APIs

`CRUD /v1/admin/vehicles`  
`POST /v1/admin/vehicles/:id/transfer-branch`  
`GET /v1/admin/vehicles/expiries`

## Database

`Vehicle`, `VehicleDocument`, `VehicleOdometerLog`, `Branch` (fleet-service owns City/Branch)

## Validations

- Registration unique
- Insurance must cover booking dates before assignment
- Cannot assign BLOCKED/MAINTENANCE vehicle
- Partner vehicles need active partner contract

## RBAC

FLEET_OPS, BRANCH_MANAGER (own branch), CITY_MANAGER, SUPER_ADMIN.

## Business benefit

Stops treating “car in CMS” as the same thing as “KA-01-XX-1234 on the road”.

## Priority / complexity

**P0 for vehicle table + assignment. P1 for document expiries. Complexity: M.**

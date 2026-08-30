# 15. Partner management, commission & settlement

## Feature purpose

Admin-only control of car owners: onboard partner, attach vehicles, set commission, generate settlement from completed trips.

**No partner self-service portal.**

## Customer-side actions

- None (they book Dream-Drive branded)

## Admin-side actions

- CRUD partners, bank details, contracts
- Attach / detach vehicles
- Set commission % or flat per product
- Generate settlement period, mark paid
- Hold payout if damage open

## Backend APIs

`CRUD /v1/admin/partners`  
`PUT /v1/admin/partners/:id/commission-rules`  
`POST /v1/admin/settlements/generate`  
`POST /v1/admin/settlements/:id/mark-paid`  
`GET /v1/admin/partners/:id/ledger`

## Database

`Partner`, `PartnerContract`, `CommissionRule`, `LedgerEntry`, `Settlement`, `SettlementLine`

Ledger: `TRIP_EARNING`, `COMMISSION`, `PENALTY`, `PAYOUT`, `ADJUSTMENT`

## Validations

- Settlement only includes COMPLETED bookings with no open damages
- Commission computed server-side from rule version at booking time (frozen)
- Bank account required before mark-paid
- Double-pay prevented by unique (partnerId, periodStart, periodEnd)

## RBAC

SUPER_ADMIN + FINANCE. CITY_MANAGER can propose, not pay.

## Business benefit

Scales fleet without buying every car.

## Priority / complexity

**P2. Complexity: L.**

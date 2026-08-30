# 16. Admin dashboard, multi-city & multi-branch operations

## Feature purpose

One console. Data scoped by city and branch. Dashboard KPIs: today’s handovers, overdue returns, pending KYC, pending signatures, failed payments, vehicles in workshop.

## Customer-side actions

- None

## Admin-side actions

- Switch city/branch context
- CRUD cities, branches, staff assignments
- Dashboard filters by date + location
- Cannot see other cities unless CITY_MANAGER / SUPER_ADMIN

## Backend APIs

`GET /v1/admin/dashboard` (platform-service aggregates)  
`CRUD /v1/admin/cities`  
`CRUD /v1/admin/branches`  
`PUT /v1/admin/staff/:id/scope`

## Database

`City`, `Branch`, `StaffScope` (userId + cityId + branchId)

## Validations

- Every vehicle, booking, driver belongs to a branch
- Cross-branch one-way drop creates a transfer task (vehicle branch updates on return)

## RBAC

Enforced at gateway using `StaffScope`. SUPER_ADMIN bypass.

## Business benefit

Lets Dream-Drive expand beyond one city without a new Firebase project.

## Priority / complexity

**P0 for City/Branch on every entity. P1 for rich dashboard. Complexity: M.**

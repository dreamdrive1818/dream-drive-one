# 12. Maintenance & workshop management

## Feature purpose

Plan workshop time so availability engine does not promise a car that is in service.

## Customer-side actions

- None (subscription customers may see “swap due to service”)

## Admin-side actions

- Create job (preventive / breakdown)
- Schedule workshop slot → writes `AvailabilityBlock`
- Log parts, labour, cost, odometer
- Close job → vehicle AVAILABLE

## Backend APIs

`CRUD /v1/admin/maintenance-jobs`  
`POST /v1/admin/maintenance-jobs/:id/complete`

## Database

`Workshop`, `MaintenanceJob`, `MaintenancePart`

## Validations

- Job dates cannot overlap an ONGOING booking (force swap first)
- Completing job requires odometer and cost
- Blocks catalog availability immediately on schedule

## RBAC

FLEET_OPS, BRANCH_MANAGER. FINANCE reads costs.

## Business benefit

Protects utilization and residual value.

## Priority / complexity

**P2. Complexity: M.**

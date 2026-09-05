# 12. Maintenance & workshop management

**Status: ✅ Implemented**

## Feature purpose

Plan workshop time so availability engine does not promise a car that is in service.

## Customer-side actions

- None for daily rentals
- Subscription customers see **“swap due to service”** on account home / booking when fleet flags the car

## Admin-side actions

- CRUD workshops (`/maintenance` → Workshops)
- Create job (preventive / breakdown), optional slot
- Schedule workshop slot → writes `AvailabilityBlock` `MAINT:{jobId}` and sets vehicle `MAINTENANCE`
- Log parts, labour, cost, odometer
- Close job → requires odometer + cost, releases block, vehicle `AVAILABLE` if no other open jobs

## Backend APIs

```
CRUD /v1/admin/workshops
GET    /v1/admin/maintenance-jobs
GET    /v1/admin/maintenance-jobs/:id
POST   /v1/admin/maintenance-jobs
PATCH  /v1/admin/maintenance-jobs/:id
POST   /v1/admin/maintenance-jobs/:id/complete
POST   /v1/admin/maintenance-jobs/:id/cancel
DELETE /v1/admin/maintenance-jobs/:id
```

## Database

| Model | Status |
|---|---|
| `Workshop` | ✅ Enhanced — `phone`, `active`, optional `cityId` |
| `MaintenanceJob` | ✅ Enhanced — `type`, `status`, optional dates, `labourPaise`, `odometerKm`, `completedAt` |
| `MaintenancePart` | ✅ Enhanced — `unitPaise` |
| `MaintenanceJobType` / `MaintenanceJobStatus` | ✅ New enums |
| `Subscription.swapDueReason` | ✅ New — set to `SERVICE` when an ONGOING subscription blocks the slot |

## Validations

- Job dates cannot overlap an ONGOING booking (force swap first; subscription customers are notified)
- Completing a job requires odometer (not below current) and cost
- Blocks catalog availability immediately on schedule (`AvailabilityBlock` + only `SCHEDULED`/`IN_PROGRESS` jobs count as busy)
- Completed/cancelled jobs do not keep the car off the shelf
- Sold vehicles cannot be booked into workshop

## RBAC

Write: FLEET_OPS, BRANCH_MANAGER, CITY_MANAGER (SUPER_ADMIN always).  
Read: those roles plus **FINANCE** (costs visible). BRANCH_MANAGER list is scoped to `x-branch-id` when set.

## Business benefit

Protects utilization and residual value.

## Priority / complexity

**P2. Complexity: M.**

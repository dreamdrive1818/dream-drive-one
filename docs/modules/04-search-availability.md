# 4. Search, discovery & availability engine

## Feature purpose

Answer: “which cars can I rent in this city, for these dates, at this price?” without overbooking.

## Customer-side actions

- Filter by city, dates, type, seats, fuel, transmission, price, self-drive vs chauffeur
- Sort by price / popularity
- See blocked dates on a car detail calendar

## Admin-side actions

- Set buffer hours between bookings
- Block a vehicle for maintenance
- Set seasonal pricing rules
- Mark car published / featured

## Backend APIs

| Method | Route | Service |
| --- | --- | --- |
| GET | `/v1/public/search` | catalog |
| GET | `/v1/public/cars/:slug` | catalog |
| GET | `/v1/public/cars/:id/availability` | catalog |
| PUT | `/v1/admin/pricing-rules` | catalog |
| POST | `/v1/internal/availability/reserve` | catalog (called by booking) |

Search query: `cityId`, `from`, `to`, `rentalType`, `seats`, `fuel`, `transmission`, `minPrice`, `maxPrice`.

Availability algorithm (MVP):

1. Resolve `CarModel` → list of `Vehicle` in city/branch
2. Exclude vehicles with overlapping `Booking` in statuses HOLD, CONFIRMED, ONGOING
3. Exclude `MaintenanceWindow` and `ManualBlock`
4. Apply buffer (e.g. 3 hours) after previous drop-off
5. Return cheapest available vehicle of that model, or model-level “from price”

HOLD is created for 15 minutes at checkout (Redis + row). Expired HOLDs release automatically.

## Database

`CarModel`, `Vehicle` (owned by fleet but catalog reads replica/view), `PricingRule`, `AvailabilityBlock`, `SearchIndex` (optional materialized)

For MVP catalog-service **reads** `Vehicle` and `Booking` via internal APIs, not cross-DB joins.

## Validations

- `from` < `to`; max rental length per product type
- Cannot search past dates
- Unpublished models never appear

## RBAC

Public search. Admin pricing: SUPER_ADMIN, CITY_MANAGER, FINANCE.

## Business benefit

Today there is no real availability — bookings are a form. This is the difference between a brochure and a rental system.

## Priority / complexity

**P0. Complexity: L.**

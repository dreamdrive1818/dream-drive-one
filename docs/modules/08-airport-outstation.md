# 8. Airport, outstation, one-way & tour packages

**Status: ✅ Implemented**

## Feature purpose

Productize chauffeur trips that are not a simple hourly local booking.

## Customer-side actions

- Airport: pick terminal, optional flight number, expected wait minutes
- Outstation: destination dates + estimated km (extra km billed on return)
- One-way: different drop city/branch + configured one-way fee
- Tour: choose packaged itinerary (fixed price) then a matching car class

## Admin-side actions

- Configure airport terminals, free wait, per-minute wait, night window/surcharge
- Configure city pairs and one-way fees
- CRUD tour packages (days, inclusions, car class, itinerary)
- Set outstation driver allowance per night
- Add extra km / extra hours on return (`POST /v1/admin/bookings/:id/extras`)

## Backend APIs

### Public
- `GET  /v1/public/packages` — published tours + itinerary
- `GET  /v1/public/packages/:slug` — package detail
- `GET  /v1/public/city-pairs` — one-way fees
- `GET  /v1/public/airports?cityId=` — active terminals
- `POST /v1/quotes` with `rentalType = AIRPORT | OUTSTATION | ONE_WAY | TOUR_PACKAGE`

### Admin — packages / pairs
- `GET/POST/PATCH /v1/admin/packages` + `POST .../delete` (unpublish)
- `GET/POST /v1/admin/city-pairs` + `POST .../:id/delete`
- `GET /v1/admin/trip-extras`
- `POST /v1/admin/bookings/:id/extras`

### Admin — airports (fleet)
- `GET/POST/PATCH /v1/admin/airports` + `POST .../delete`

### Catalog
- `PUT /v1/admin/catalog-settings` includes `driverAllowancePerNightPaise`

## Database

| Model | Status |
|---|---|
| `AirportTerminal` | ✅ Enhanced — wait + night fields |
| `CityPairRate` | ✅ City relations |
| `TourPackage` | ✅ city, carClass, inclusions, deposit |
| `TourDay` | ✅ description |
| `TripExtra` | ✅ New catalog of extra types |
| `Booking` | ✅ terminalId, packageId, estimatedKm, waitMinutes |
| `CatalogSettings` | ✅ driverAllowancePerNightPaise |

## Validations

- Flight number optional; wait charges apply after free minutes
- Outstation driver allowance auto-added per IST midnight crossed
- One-way requires drop city ≠ pickup city and a configured pair
- Tour package car class must match the selected car model type
- Tour still reserves a vehicle at booking (prevents oversell). Registration is an ops concern until handover.

## RBAC

- Package CRUD: SALES, CITY_MANAGER, SUPER_ADMIN
- City-pair rates: FINANCE, CITY_MANAGER, SUPER_ADMIN
- Airports: FLEET_OPS, CITY_MANAGER, SUPER_ADMIN
- Extras: FLEET_OPS on return; SALES can override earlier

## Gateway routing

`/v1/public/packages`, `/v1/public/city-pairs`, `/v1/admin/packages`, `/v1/admin/city-pairs`, `/v1/admin/trip-extras` → booking-service  
`/v1/public/airports`, `/v1/admin/airports` → fleet-service

## Business benefit

Matches how Dream-Drive already sells with-driver (local vs intercity / one-way) — structured instead of free text.

## Priority / complexity

**P1 for airport + one-way rates. P2 for packaged tours. Complexity: M.**

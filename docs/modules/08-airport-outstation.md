# 8. Airport, outstation, one-way & tour packages

## Feature purpose

Productize chauffeur trips that are not a simple hourly local booking.

## Customer-side actions

- Airport: pick terminal, flight number, wait time
- Outstation: destination city, days, estimated km
- One-way: different drop city/branch + one-way fee
- Tour: choose packaged itinerary (fixed price)

## Admin-side actions

- Configure airport terminals, wait slabs, night charges
- Configure city pairs and one-way fees
- CRUD tour packages (days, inclusions, car class)
- Add extra km / extra hours on return

## Backend APIs

`GET /v1/public/packages`  
`GET /v1/public/city-pairs`  
`POST /v1/quotes` with `product = AIRPORT | OUTSTATION | ONE_WAY | TOUR`  
Admin: `/v1/admin/packages`, `/v1/admin/city-pairs`

## Database

`AirportTerminal`, `CityPairRate`, `TourPackage`, `TourDay`, `TripExtra`

## Validations

- Flight number optional but wait charges apply after free minutes
- Outstation driver allowance auto-added per night
- One-way requires drop city ≠ pickup city
- Tour package inventory = car class, not a specific vehicle until T-24h

## RBAC

SALES can override extras. CITY_MANAGER owns rates for their city.

## Business benefit

Matches how Dream-Drive already sells with-driver (local vs intercity / one-way) — structured instead of free text.

## Priority / complexity

**P1 for airport + one-way rates. P2 for packaged tours. Complexity: M.**

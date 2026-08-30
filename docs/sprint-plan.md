# 4-week development sprint (practical MVP)

Assumption: 2 full-stack engineers. Goal is a **bookable self-drive + with-driver path**, not all 22 modules in production.

## Week 1 — Foundation

**Ship:** monorepo running, auth, cities/branches, car models, admin login.

- Docker Postgres + Redis, Prisma migrate
- Gateway + identity (Firebase sync, roles, `/me`)
- Fleet: City, Branch, Vehicle stub
- Catalog: CarModel CRUD + public list (no availability yet)
- Admin: login, cars, vehicles, staff
- Web: home shell, login, car list (shadcn + Tailwind)
- Notification: OTP email (port existing Gmail OAuth)

**Exit:** staff can add a car; customer can log in.

## Week 2 — Quote, book, pay

**Ship:** availability + HOLD + Razorpay token.

- Availability engine + buffer + maintenance block stub
- Quotes + Booking HOLD/AWAITING_PAYMENT
- Payment orders + webhook + success poll
- Web checkout + pay + success
- Admin bookings list
- Offer codes (flat/percent) if time

**Exit:** a test booking can be paid in Razorpay test mode without overbooking.

## Week 3 — KYC, Zoho, Leegality

**Ship:** legal path for self-drive.

- KYC upload + admin decision
- Zoho form webhook parity with current `form_entries`
- Agreement PDF generate
- Leegality send + webhook
- Booking status AWAITING_KYC / AWAITING_SIGNATURE / CONFIRMED
- Email confirmation (port current HTML)
- Tracking page

**Exit:** paid booking can be confirmed after KYC + sign in staging.

## Week 4 — Ops polish + chauffeur + CMS

**Ship:** admin can run a real weekend.

- Assign vehicle (and driver for with-driver)
- Handover/return **minimal** (odometer + photos, no full damage matrix)
- Admin dashboard KPIs
- CMS banners + contact → CRM lead
- Airport/one-way **rate tables** if time; else keep with-driver local/intercity from current site
- Hardening: rate limits, audit, deploy staging

**Exit:** demo for client: search → book → pay → KYC → sign → admin handover.

## Explicitly not in these 4 weeks

Subscription, tour packages, workshop module, partner settlements, wallet/loyalty, support desk, finance GST pack, Expo store build.

Start mobile only if week 2–3 APIs are stable — otherwise it slips to week 5–8.

## Complexity cheat sheet

| Module | Priority | Complexity |
| --- | --- | --- |
| 1 Auth & security | P0 | M |
| 2 Public CMS | P1 | S–M |
| 3 Customer dashboard | P0 | S |
| 4 Search & availability | P0 | L |
| 5 Booking engine | P0 | L |
| 6 Payments | P0 | L |
| 7 Subscription | P2 | M |
| 8 Airport / packages | P1–P2 | M |
| 9 KYC | P0 | M |
| 10 Leegality / PDF | P0 | M–L |
| 11 Fleet | P0 | M |
| 12 Maintenance | P2 | M |
| 13 Handover | P1 | M |
| 14 Drivers | P1 | S–M |
| 15 Partners | P2 | L |
| 16 Multi-city admin | P0–P1 | M |
| 17 Finance reports | P2 | M–L |
| 18 Offers / wallet | P1–P2 | M |
| 19 Reviews / tickets | P2 | S–M |
| 20 Notifications | P0 | S |
| 21 CRM | P1 | S |
| 22 Mobile | P2 | L |

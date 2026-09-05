# 1. Ownership and scope

## In scope for the app developer

Customer **Android + iOS** app (Expo / React Native or equivalent). Same `/v1` contract as the website.

### Screens (must ship)

1. Splash / force-update
2. Login (email OTP, email+password, Google)
3. Register
4. Home (banners, featured cars, contact)
5. City + date search
6. Search results + filters
7. Car detail + availability calendar
8. Quote / checkout summary
9. Razorpay payment
10. Payment success / failure (poll status — do not trust the SDK alone)
11. KYC upload + submit
12. Agreement view + open Leegality sign URL
13. My bookings list
14. Booking detail + live status
15. Guest track booking (publicId + phone OTP)
16. Profile, addresses, phone change
17. Invoices (list + PDF)
18. Wallet (read-only display)
19. Support tickets
20. Notifications inbox (list from push + in-app)
21. Packages / tours
22. Subscription plans → same checkout path
23. Contact / lead form
24. Legal CMS pages (terms, privacy)

### App-only extras

- Register FCM token: `POST /v1/me/devices`
- Deep link: `dreamdrive://bookings/:id` and `dreamdrive://track/:publicId`
- Min app version / force update (app-store + remote config; API does not pin versions yet — handle in the app or via `GET /v1/public/config` if a field is added later)

## Out of scope (do not build)

| Area | Why |
| --- | --- |
| Admin panel | Separate web app (`apps/admin`). Staff JWT + roles. |
| Partner portal | Does not exist. Staff manage partners. |
| Delivery / pickup executive app | Explicitly excluded from the product. |
| Vehicle assignment, handover inspection, deposits capture | Admin / fleet ops. App only **shows** status. |
| KYC approve / reject | Support staff. App only uploads and shows status. |
| Pricing rules, offers CRUD | Admin. App applies an offer **code** on a quote. |
| Calling `/internal/*` | Service-to-service. 404 from the public API. |
| Writing Firestore / Cloudinary from the client as source of truth | All writes go through the API. |

## RACI

| Decision | App | API owner |
| --- | --- | --- |
| Screen copy, colours, navigation | **A/R** | C |
| Which fields are required on a form | C | **A/R** (API validation is source of truth) |
| Display price | R (format paise → ₹) | **A** (compute) |
| “Is this car free?” | R (show `available`) | **A** |
| Payment success | R (open Razorpay, then poll) | **A** (webhook) |
| Booking status after pay / KYC / sign | R (poll or socket) | **A** |
| Live base URL, secrets, test users | I | **A/R** |
| Play Store / App Store listing | **A/R** | I |

R = responsible, A = accountable, C = consulted, I = informed.

## Environments

| Env | Who uses it | App `EXPO_PUBLIC_API_URL` |
| --- | --- | --- |
| Local | API owner | `http://localhost:4000` (Android emulator: `http://10.0.2.2:4000`) |
| Staging / live | App + API | **Fill in `live-api.config.json`** |

`dev:` bearer tokens work **only** when `NODE_ENV !== production`. Never use them against live.

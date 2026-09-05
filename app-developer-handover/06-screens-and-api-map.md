# 6. Screens → API map

Build screens in this order. Each row is the **minimum** the screen must call.

| # | Screen | When | Calls |
| ---: | --- | --- | --- |
| 1 | Splash | Cold start | `GET /health` · restore token · `GET /v1/me` if token |
| 2 | Login / Register | No session | `POST /v1/auth/otp/send` · `otp/verify` · or `login` / `register` / `google` · then `POST /v1/me/devices` |
| 3 | Home | After login or guest | `GET /v1/public/home` (or config + banners + search) · `GET /v1/public/cities` |
| 4 | Search | User picked city/dates/type | `GET /v1/public/catalog-config` · `GET /v1/public/search?...` |
| 5 | Car detail | Tap result | `GET /v1/public/cars/:slug` · `GET /v1/public/cars/:id/availability?month=` |
| 6 | Airport / extras | `rentalType=AIRPORT` | `GET /v1/public/airports?cityId=` |
| 7 | Packages | Tours tab | `GET /v1/public/packages` · `GET /v1/public/packages/:slug` |
| 8 | Subscriptions | Subscribe tab | `GET /v1/public/subscriptions/plans` · `POST /v1/subscriptions` |
| 9 | Checkout | Signed-in | `POST /v1/quotes` · `GET /v1/quotes/:id` · `POST /v1/quotes/:id/apply-offer` |
| 10 | Place booking | Confirm | `POST /v1/bookings` `{ quoteId }` |
| 11 | Pay | `AWAITING_PAYMENT` | `POST /v1/payments/orders` · Razorpay · `POST /v1/payments/verify` · poll `GET /v1/payments/:id` |
| 12 | Success | After SUCCESS | `GET /v1/bookings/:id` — branch UI on **status** |
| 13 | KYC | `AWAITING_KYC` | `GET /v1/me/kyc` · `POST /v1/kyc/uploads` · `POST /v1/kyc/submit` |
| 14 | Sign | `AWAITING_SIGNATURE` | `GET /v1/me/agreements` · open `envelope.signUrl` · poll booking |
| 15 | My bookings | Account | `GET /v1/me/bookings` |
| 16 | Booking detail | Tap row | `GET /v1/bookings/:id` · socket subscribe · poll |
| 17 | Guest track | Logged out | `POST /v1/public/bookings/track/otp` · `track/verify` |
| 18 | Cancel | Allowed statuses | `POST /v1/bookings/:id/cancel` |
| 19 | Account hub | Tab | `GET /v1/me/dashboard` or parallel me/kyc/invoices/tickets/wallet |
| 20 | Profile | Edit | `GET/PATCH /v1/me` · `POST /v1/me/phone/verify` · addresses CRUD |
| 21 | Invoices | Tab | `GET /v1/me/invoices` · PDF |
| 22 | Wallet | Tab | `GET /v1/me/wallet` |
| 23 | Tickets | Tab | `GET/POST /v1/me/tickets` · messages |
| 24 | Contact | Footer | `POST /v1/public/contact` |
| 25 | Legal | Register / settings | `GET /v1/public/pages/:slug` |
| 26 | Review | `COMPLETED` | `POST /v1/reviews` |

## Status → primary CTA on booking detail

| `booking.status` | Primary button |
| --- | --- |
| `AWAITING_PAYMENT` | Pay |
| `AWAITING_KYC` | Complete KYC |
| `AWAITING_SIGNATURE` | Sign agreement |
| `CONFIRMED` | Get directions / call branch (from `public/config`) |
| `HANDOVER` `ONGOING` | Call driver if `driverAssignment.driver.phone` |
| `COMPLETED` | Write review |
| `CANCELLED` `NO_SHOW` | Book again |

## Website route equivalents (for QA vs web)

| App screen | Web path |
| --- | --- |
| Home | `/` |
| Search | `/cars` |
| Detail | `/cars/[slug]` |
| Checkout | `/checkout/[quoteId]` |
| Pay | `/checkout/pay` |
| Success | `/checkout/success` |
| Account | `/account` |
| Bookings | `/account/bookings` |
| KYC | `/account/kyc` |
| Track | `/track/[bookingId]` |
| Login | `/login` |

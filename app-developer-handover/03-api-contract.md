# 3. Customer API contract

Central API. Prefix `/v1` unless noted. Money = paise. Dates = ISO UTC.

**Legend:** 🔓 public · 🔒 Bearer token (customer)

Admin (`/v1/admin/**`) and `/internal/**` are **not** for the app. They are omitted here.

---

## 3.1 Health

### `GET /health` 🔓

**Does:** Process liveness for the app splash / connectivity banner.

Response:

```json
{ "service": "api", "status": "ok" }
```

---

## 3.2 Auth and profile

### `POST /v1/auth/otp/send` 🔓

**Does:** Emails a 6-digit OTP (5 min). Rate limit 3 / 15 min / IP.

Request:

```json
{ "email": "user@example.com" }
```

Response: `{ "ok": true }`  
Non-production may also include `"devCode": "123456"`.

Errors: `400` email required · `429` too many OTP requests.

### `POST /v1/auth/otp/verify` 🔓

**Does:** Verifies OTP, creates/loads user, returns session token.

Request:

```json
{ "email": "user@example.com", "code": "123456" }
```

Response:

```json
{
  "ok": true,
  "token": "dd1.<payload>.<sig>",
  "user": {
    "id": "clx...",
    "firebaseUid": "otp:user@example.com",
    "email": "user@example.com",
    "phone": null,
    "pendingPhone": null,
    "status": "ACTIVE",
    "createdAt": "2026-09-05T12:00:00.000Z",
    "fullName": "user",
    "kycStatus": "NOT_STARTED",
    "kycValidUntil": null,
    "nameLocked": false,
    "roles": ["CUSTOMER"],
    "cityId": null,
    "branchId": null,
    "canSwitchCity": false,
    "canSwitchBranch": false,
    "addresses": []
  }
}
```

Store `token`. Errors: invalid/expired OTP, too many attempts.

### `POST /v1/auth/register` 🔓

**Does:** Firebase email/password sign-up. Password min 8 chars.

Request:

```json
{ "email": "user@example.com", "password": "secret123", "fullName": "Anita Rao" }
```

Response: `{ "token": "<firebase-id-token>", "user": { ...same shape as above } }`

### `POST /v1/auth/login` 🔓

**Does:** Firebase email/password sign-in.

Request: `{ "email": "...", "password": "..." }`  
Response: `{ "token": "<firebase-id-token>", "user": { ... } }`

### `POST /v1/auth/google` 🔓

**Does:** Verifies Google/Firebase ID token, mints `dd1.` session.

Request: `{ "idToken": "<google-id-token>" }`  
Response: `{ "token": "dd1....", "user": { ... } }`

### `POST /v1/auth/sync` 🔒

**Does:** Upserts PG user from the bearer identity. Call once after Firebase login if needed.

Request (optional): `{ "fullName": "Anita Rao" }`  
Response: user object (same as `GET /v1/me`).

### `GET /v1/me` 🔒

**Does:** Current profile, KYC flags, addresses.

Response: user object as in OTP verify.  
`nameLocked: true` when KYC is `APPROVED` — do not offer a name edit (API will 403).

### `PATCH /v1/me` 🔒

**Does:** Update name / start phone change / upsert default address.

Request:

```json
{
  "fullName": "Anita Rao",
  "phone": "9876543210",
  "address": {
    "line1": "12 MG Road",
    "line2": "",
    "city": "Ranchi",
    "state": "JH",
    "zip": "834001",
    "country": "IN"
  }
}
```

Phone must be a valid Indian mobile (`[6-9]` + 9 digits). Changing phone does **not** apply immediately — OTP is emailed.

Response: user fields plus:

```json
{
  "pendingPhone": "9876543210",
  "phoneChangeRequired": true,
  "devCode": "123456"
}
```

(`devCode` only in non-production.)

Then call `POST /v1/me/phone/verify`.

### `POST /v1/me/phone/verify` 🔒

Request: `{ "code": "123456" }`  
Response: updated user (`phone` set, `pendingPhone` null).

### Addresses 🔒

`POST /v1/me/addresses`

```json
{
  "line1": "12 MG Road",
  "line2": "Apt 4",
  "city": "Ranchi",
  "state": "JH",
  "zip": "834001",
  "country": "IN",
  "isDefault": true
}
```

`PATCH /v1/me/addresses/:id` — same fields.  
`DELETE /v1/me/addresses/:id`  
All return the full user (`GET /v1/me` shape) except create which returns the address row.

### `GET /v1/me/dashboard` 🔒

**Does:** Account home payload: profile, recent bookings, KYC, agreements, invoices, tickets, wallet, active subscriptions.

### `POST /v1/me/devices` 🔒

**Does:** Register FCM / APNs token for push.

Request: `{ "token": "<fcm-token>", "platform": "android" | "ios" | "web" }`  
Response: device token row. Call after login and whenever the push token rotates.

---

## 3.3 Public catalog and CMS

### `GET /v1/public/config` 🔓

```json
{
  "siteName": "Dream Drive",
  "phone": "+91-994-202-7772",
  "whatsapp": "919942027772",
  "email": "Dreamdrive1818@gmail.com",
  "address": "105 Jagriti Bhawan, ..."
}
```

Use for splash footer, call / WhatsApp buttons.

### `GET /v1/public/home` 🔓

Home composition: CMS page, banners (`hero` / `strip` / `promo` / `side`), latest blogs, testimonials, featured fleet (with `pricePaise`), `config`.

### `GET /v1/public/catalog-config` 🔓

```json
{
  "bufferHours": 3,
  "maxRentalDays": 30,
  "driverAllowancePerNightPaise": 30000,
  "maxDaysByType": {
    "SELF_DRIVE": 30,
    "WITH_DRIVER_LOCAL": 7,
    "WITH_DRIVER_INTERCITY": 15,
    "AIRPORT": 2,
    "OUTSTATION": 15,
    "ONE_WAY": 5,
    "TOUR_PACKAGE": 21,
    "SUBSCRIPTION": 365
  }
}
```

Enforce date-range max in the UI using this, but the API still validates.

### `GET /v1/public/cities` 🔓

Active cities with active branches (pickup/drop pickers).

### `GET /v1/public/airports?cityId=` 🔓

Active airport terminals: wait minutes, night surcharge window (IST), city.

### `GET /v1/public/search` 🔓

Query:

| Param | Required | Notes |
| --- | --- | --- |
| `cityId` | recommended | Filter models to city |
| `from` `to` | together | ISO dates; cannot be past; `from` < `to` |
| `rentalType` | no | See enum below |
| `type` `seats` `fuel` `transmission` | no | Filters |
| `minPrice` `maxPrice` | no | Daily paise |
| `sort` | no | `price-asc` · `price-desc` · `popularity` (default featured) |

`rentalType` enum:

`SELF_DRIVE` · `WITH_DRIVER_LOCAL` · `WITH_DRIVER_INTERCITY` · `AIRPORT` · `OUTSTATION` · `ONE_WAY` · `TOUR_PACKAGE` · `SUBSCRIPTION`

Response: **array** of:

```json
{
  "id": "clx...",
  "slug": "swift-dzire",
  "name": "Swift Dzire",
  "type": "Sedan",
  "seats": 5,
  "fuel": "Petrol",
  "transmission": "Manual",
  "featured": true,
  "city": { "id": "...", "name": "Ranchi" },
  "images": [{ "url": "https://...", "sortOrder": 0 }],
  "pricePaise": 249900,
  "extraKmPaise": 1200,
  "depositPaise": 500000,
  "seasonal": false,
  "available": true,
  "vehicleId": "clx...",
  "availableCount": 2,
  "bookingCount": 14
}
```

If `from`/`to` omitted, `available` is `true` and `vehicleId`/`availableCount` may be null. Hide or disable cars with `available: false` when dates are set.

### `GET /v1/public/cars/:slug` 🔓

Car detail (published only) + `pricingRules` + `bufferHours` + `maxRentalDays` + `maxDaysByType`.

### `GET /v1/public/cars/:id/availability` 🔓

Query: `from`, `to`, `month` (`YYYY-MM`).

```json
{
  "available": true,
  "vehicleId": "clx...",
  "bufferHours": 3,
  "maxRentalDays": 30,
  "month": "2026-09",
  "busyDays": ["2026-09-12", "2026-09-13"]
}
```

Grey out `busyDays` on the calendar. Buffer hours are already applied server-side.

### Packages, city pairs, subscriptions 🔓

- `GET /v1/public/packages` — published tours + day itinerary + city
- `GET /v1/public/packages/:slug`
- `GET /v1/public/city-pairs` — one-way fees (`oneWayPaise`)
- `GET /v1/public/subscriptions/plans` — active plans + car thumbnail

### CMS 🔓

- `GET /v1/public/pages` optional `?kind=`
- `GET /v1/public/pages/:slug` — legal / content
- `GET /v1/public/banners?placement=HERO`
- `GET /v1/public/blogs` `?category=` `?take=`
- `GET /v1/public/blogs/:slug`
- `GET /v1/public/blogs/:slug/comments`
- `POST /v1/public/blogs/:slug/comments` `{ name, email, comment }`
- `GET /v1/public/blog-categories`
- `GET /v1/public/testimonials`
- `POST /v1/public/testimonials` — submitted **inactive** until admin approves (`pending: true`)

### Leads / contact 🔓

`POST /v1/public/contact`

```json
{
  "name": "Anita",
  "email": "a@b.com",
  "phone": "9876543210",
  "message": "Need a car on 12 Sep",
  "city": "Ranchi",
  "source": "app"
}
```

Need `name` and (email or phone). Dedupes leads within 7 days.

`POST /v1/public/leads` — same, `name` optional (defaults “Website enquiry”).

---

## 3.4 Quotes and bookings

Login required to price and hold a car.

### `POST /v1/quotes` 🔒

**Does:** Server-side price freeze (~20 min). Does **not** lock a vehicle yet.

Request:

```json
{
  "carModelId": "clx...",
  "rentalType": "SELF_DRIVE",
  "startsAt": "2026-09-12T04:30:00.000Z",
  "endsAt": "2026-09-14T04:30:00.000Z",
  "pickupBranchId": "clx...",
  "dropBranchId": "clx...",
  "offerCode": "WELCOME10",
  "extras": [{ "label": "Child seat", "amountPaise": 20000 }],
  "packageId": null,
  "terminalId": null,
  "flightNumber": null,
  "waitMinutes": null,
  "estimatedKm": null,
  "tripDirection": "ROUND_TRIP"
}
```

`tripDirection`: `ONE_WAY` | `ROUND_TRIP`.

Airport: send `terminalId`, optional `flightNumber`, `waitMinutes`.  
Tour: send `packageId`.  
One-way: different `dropBranchId` / city pair fee is applied on the server.

Response (hydrate):

```json
{
  "id": "clx...",
  "userId": "clx...",
  "carModelId": "clx...",
  "rentalType": "SELF_DRIVE",
  "startsAt": "...",
  "endsAt": "...",
  "amountPaise": 499800,
  "depositPaise": 500000,
  "offerId": null,
  "expiresAt": "...",
  "expired": false,
  "payload": { "days": 2, "pickupBranchId": "...", "grossPaise": 499800 },
  "carModel": { "id": "...", "name": "...", "slug": "...", "images": [{ "url": "..." }] },
  "pickupBranch": { "id": "...", "name": "...", "cityId": "..." },
  "dropBranch": { "id": "...", "name": "...", "cityId": "..." },
  "terminal": null,
  "tourPackage": null
}
```

Show `amountPaise` + `depositPaise` separately. If `expired: true`, create a new quote.

### `GET /v1/quotes/:id` 🔒

Same hydrate. 400 if not your quote.

### `POST /v1/quotes/:id/apply-offer` 🔒

Request: `{ "code": "WELCOME10" }`  
Returns updated quote. 400 if quote expired / invalid code.

### `POST /v1/bookings` 🔒

**Does:** Convert quote → booking, **hold a vehicle** (~15 min), status → `AWAITING_PAYMENT`. Same `quoteId` is idempotent.

Request: `{ "quoteId": "clx..." }`

Response: full booking (see below).  
If no vehicle: booking cancelled internally, error (no availability).

### `GET /v1/bookings/:id` 🔒

`:id` = internal id **or** `publicId`. Owner only.

Typical fields:

```json
{
  "id": "clx...",
  "publicId": "DD-AB12CD",
  "userId": "clx...",
  "status": "AWAITING_PAYMENT",
  "rentalType": "SELF_DRIVE",
  "startsAt": "...",
  "endsAt": "...",
  "amountPaise": 499800,
  "depositPaise": 500000,
  "pickupBranch": { "id": "...", "name": "...", "city": { "name": "Ranchi" } },
  "dropBranch": { "...": "..." },
  "payments": [],
  "kycCase": { "id": "...", "status": "NOT_STARTED" },
  "agreements": [],
  "extras": [],
  "history": [{ "from": "HOLD", "to": "AWAITING_PAYMENT", "createdAt": "..." }],
  "driverAssignment": null,
  "flightNumber": null
}
```

### `GET /v1/me/bookings` 🔒

List, newest first, with car thumbnail, branches, payments, kyc, agreements, driver.

### `POST /v1/bookings/:id/cancel` 🔒

Request: `{ "reason": "Plans changed" }`

Cannot cancel after `HANDOVER` / `ONGOING` / `COMPLETED`.

Response: booking plus `refundPaise`, `refundPct`, `policyHoursBeforeStart`.

**Refund bands (hire token/balance only):**

| Product | 100% | 50% | 0% |
| --- | --- | --- | --- |
| Self-drive | ≥ 48h before start | ≥ 24h | after |
| With driver local | ≥ 24h | ≥ 6h | after |
| Intercity / outstation | ≥ 48h | ≥ 12h | after |
| Airport | ≥ 12h | ≥ 3h | after |
| One-way | ≥ 24h | ≥ 6h | after |
| Tour | ≥ 72h | ≥ 24h | after |
| Subscription | ≥ 168h (7d) | ≥ 48h | after |

Show policy **before** confirm. Server is source of truth.

### Guest track 🔓

`POST /v1/public/bookings/track/otp`

```json
{ "publicId": "DD-AB12CD", "phone": "9876543210" }
```

Phone must match the booking user. Response: `{ "ok": true, "expiresInSec": 300 }`.

`POST /v1/public/bookings/track/verify`

```json
{ "publicId": "DD-AB12CD", "phone": "9876543210", "code": "123456" }
```

Returns the booking payload if OTP matches (no account required).

### `POST /v1/subscriptions` 🔒

Request: `{ "planId": "clx..." }`  
Creates a `SUBSCRIPTION` quote+booking. Then pay with the normal payment APIs.

---

## 3.5 Payments

### `POST /v1/payments/orders` 🔒

Request:

```json
{ "bookingId": "clx... or DD-AB12CD", "kind": "TOKEN" }
```

`kind`: `TOKEN` | `BALANCE` | `DEPOSIT` | `EXTRA` | `PENALTY` (customers use TOKEN / BALANCE / DEPOSIT).

Response:

```json
{
  "paymentId": "clx...",
  "orderId": "order_xxxxx",
  "amountPaise": 499800,
  "currency": "INR",
  "keyId": "rzp_live_xxx",
  "mock": false
}
```

Open Razorpay Checkout:

- `key` = `keyId`
- `order_id` = `orderId`
- `amount` = `amountPaise`
- `currency` = `INR`
- prefill email/phone from `GET /v1/me`

### `POST /v1/payments/verify` 🔒

Backup if webhook is slow. **Still poll.**

```json
{
  "paymentId": "clx...",
  "razorpayOrderId": "order_xxx",
  "razorpayPaymentId": "pay_xxx",
  "razorpaySignature": "..."
}
```

Mock mode: signature not required; API marks success.

### `GET /v1/payments/:id` 🔒

Poll this after checkout.

`status`: `CREATED` · `PENDING` · `SUCCESS` · `FAILED` · `REFUNDED` · `PARTIALLY_REFUNDED`

When `SUCCESS`, reload `GET /v1/bookings/:id`. Typical next statuses:

- Self-drive: `AWAITING_KYC` (then `AWAITING_SIGNATURE` → `CONFIRMED`)
- With-driver: often `CONFIRMED` after token (KYC/sign may be waived)

**Never** treat Razorpay `onSuccess` as booking confirmed.

### Invoices 🔒

- `GET /v1/me/invoices`
- `GET /v1/me/invoices/:id`
- `GET /v1/me/invoices/:id/pdf` — binary PDF (`Content-Type: application/pdf`)

GST 18% is on invoices; do not recompute GST in the app.

### `GET /v1/me/wallet` 🔒

```json
{
  "userId": "...",
  "balancePaise": 0,
  "txns": [{ "id": "...", "amountPaise": 5000, "createdAt": "..." }]
}
```

Read-only in the customer app.

---

## 3.6 KYC and agreements

### `POST /v1/kyc/uploads` 🔒

`multipart/form-data`:

- `file` — the document
- `kind` — `AADHAAR` | `PAN` | `DL` | `SELFIE` | `ADDRESS`

Or JSON `{ "kind": "DL", "url": "https://res.cloudinary.com/..." }`.

Response:

```json
{
  "ok": true,
  "kind": "DL",
  "url": "https://...",
  "publicId": "dreamdrive/kyc/...",
  "mimeType": "image/jpeg",
  "bytes": 240112
}
```

Collect `{ kind, url, publicId }` for submit. Empty body may return a signed Cloudinary slot.

### `POST /v1/kyc/submit` 🔒

```json
{
  "bookingId": "clx...",
  "aadhaarNumber": "123412341234",
  "panNumber": "ABCDE1234F",
  "dlExpiresOn": "2028-03-31",
  "notes": "",
  "documents": [
    { "kind": "DL", "url": "https://...", "publicId": "...", "mimeType": "image/jpeg" },
    { "kind": "AADHAAR", "url": "https://..." },
    { "kind": "SELFIE", "url": "https://..." }
  ]
}
```

Aadhaar = 12 digits; PAN = `ABCDE1234F`. DL must cover drop-off. Raw numbers are hashed; API returns only `last4`.

If KYC was approved in the last ~365 days and DL still covers the trip, submit **without** `documents` to reuse.

Self-drive missing docs → 400 with a clear message.

Response: KYC case (`status`: `SUBMITTED`). Admin moves it to `UNDER_REVIEW` / `APPROVED` / `REJECTED`. Poll `GET /v1/me/kyc` or booking.

### `GET /v1/me/kyc` 🔒

```json
{
  "kycStatus": "SUBMITTED",
  "kycValidUntil": null,
  "reusable": false,
  "cases": [
    {
      "id": "...",
      "status": "SUBMITTED",
      "aadhaarLast4": "1234",
      "panLast4": "234F",
      "dlExpiresOn": "...",
      "documents": [{ "id": "...", "kind": "DL", "url": "...", "status": "UPLOADED", "notes": null }]
    }
  ]
}
```

If a document `status` is `NEEDS_REUPLOAD`, re-upload that `kind` and submit again.

### `GET /v1/me/documents` 🔒

KYC + agreements together.

### Agreements 🔒

- `GET /v1/me/agreements`
- `GET /v1/me/agreements/:id`
- `GET /v1/me/agreements/:id/pdf` — unsigned PDF
- `GET /v1/me/agreements/:id/signed-pdf` — after `SIGNED`

Agreement `status`: `DRAFT` · `SENT` · `SIGNED` · `VOID` · `WAIVED`.

When `SENT`, open `envelope.signUrl` in an in-app browser (Leegality). After sign, webhook advances booking; poll booking/agreement. Do not invent a “signed” state from the WebView closing.

---

## 3.7 Tickets, reviews, extras

### Tickets 🔒

`POST /v1/me/tickets` or `POST /v1/tickets`

```json
{ "subject": "Late pickup", "body": "Driver is 40 min late", "bookingId": "DD-AB12CD" }
```

- `GET /v1/me/tickets`
- `GET /v1/me/tickets/:id` (customer messages only; internal notes hidden)
- `POST /v1/me/tickets/:id/messages` `{ "body": "Thanks" }`

Ticket `status`: `OPEN` · `PENDING` · `RESOLVED` · `CLOSED`. Cannot reply if `CLOSED`.

### `POST /v1/reviews` 🔒

```json
{
  "bookingId": "clx...",
  "carModelId": "clx...",
  "rating": 5,
  "body": "Clean car"
}
```

Created **unpublished** (`published: false`) until admin approves. Show “submitted for review”.

### Generic upload 🔒

`POST /v1/uploads` multipart `file` + `folder` (`kyc` | `media` | `testimonials` | …). Prefer `/v1/kyc/uploads` for KYC.

---

## 3.8 Booking status (app UI)

```
HOLD → AWAITING_PAYMENT → AWAITING_KYC → AWAITING_SIGNATURE → CONFIRMED
     → HANDOVER → ONGOING → RETURN_PENDING → COMPLETED
CANCELLED | NO_SHOW
```

Suggested customer copy:

| Status | Screen |
| --- | --- |
| `AWAITING_PAYMENT` | Pay now (countdown: hold ~15 min) |
| `AWAITING_KYC` | Upload documents |
| `AWAITING_SIGNATURE` | Open agreement / Leegality |
| `CONFIRMED` | Show dates, branch, driver if assigned |
| `HANDOVER` / `ONGOING` | Trip live; cancel disabled |
| `RETURN_PENDING` | Return in progress |
| `COMPLETED` | Review CTA |
| `CANCELLED` | Show refund fields if present |
| `NO_SHOW` | Explain grace (~2h after start) |

With-driver products may skip KYC/sign and go to `CONFIRMED` after payment.

---

## 3.9 Realtime

Socket.IO namespace `/booking` on `SOCKET_URL`.

Client → `booking:subscribe` `{ "bookingId": "<id or publicId>" }`  
Server → `booking:status` `{ "bookingId", "publicId", "status", "reason", "at" }`

Then refetch `GET /v1/bookings/:id` for the full object. Poll every 8s if the socket is down.

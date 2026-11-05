# Changes for the app team — 29 Sep to 13 Oct 2026

**Audience:** Mobile / app developer  
**API version:** `/v1` (no breaking path changes)  
**Status:** All items below are **done and deployed** to `dev`, `staging` and `main`.

This lists every API change from the last two weeks that the app needs to know about, what the app must do, and the web/admin-only changes you can ignore. Full request/response shapes live in [03-api-contract.md](03-api-contract.md).

---

## At a glance

| # | Change | App action | Status |
| --- | --- | --- | --- |
| 1 | ₹500 token payment with required details step | **Required** — new call before `POST /v1/payments/orders` | Done |
| 2 | Mock (test) payments | **Required** — handle `mock: true` orders without Razorpay | Done |
| 3 | Readable error messages on every error | Recommended — show `message` as-is | Done |
| 4 | Forgot / reset password | New screens if you support password login | Done |
| 5 | OTP send response fields | Read `emailSent`, `queued`, `devCode` | Done |
| 6 | Login methods can be switched on/off from admin | Hide disabled buttons using `/v1/public/config` | Done |
| 7 | New profile fields on `/v1/me` | Prefill DOB; use `passwordSet` | Done |
| 8 | Aadhaar front and back for KYC | Upload two images (`AADHAAR_FRONT`, `AADHAAR_BACK`) | Done |
| 9 | Popular getaways on the home payload | Optional home section | Done |
| 10 | Availability is now city-correct | Show the new "no vehicle" message | Done |
| 11 | `/health` reports Redis and mail | Optional, for diagnostics only | Done |

---

## 1. ₹500 token payment with a required details step

The customer now pays a **token** online to reserve the car (default **₹500**, never more than the trip total). The balance is collected later.

**New fields (paise, integers):**

- `tokenPaise` on quotes (`POST /v1/quotes` response), bookings (`GET /v1/bookings/:id`) and car models.
- Amount due now = `min(tokenPaise || 50000, amountPaise)`. Balance before handover = `amountPaise - tokenDue`.

**Flow (TOKEN only):**

```
POST /v1/bookings/:id/essentials   →   POST /v1/payments/orders   →   Razorpay (or mock)   →   POST /v1/payments/verify
```

**`POST /v1/bookings/:id/essentials`** 🔒 — **must** succeed before the order call.

```json
{
  "fullName": "Asha Kumar",
  "dateOfBirth": "1995-04-18",
  "phone": "9876543210",
  "email": "asha@example.com",
  "termsAccepted": true
}
```

Saves the name, date of birth and phone to the profile and stamps `termsAcceptedAt` on the booking. Returns the booking.

Validate these on the device first so the API never has to reject them:

| Field | Rule (same as the API) | API message if broken |
| --- | --- | --- |
| `fullName` | At least 2 characters. If `user.nameLocked` is true, send the locked name unchanged | `Enter your full name` / `403 Name is locked to the approved KYC record` |
| `dateOfBirth` | `YYYY-MM-DD`, age 18–100 | `Enter a valid date of birth` / `You must be at least 18 years old` |
| `phone` | Strip non-digits; drop a leading `91` only if 12 digits, a leading `0` only if 11 digits; result must match `^[6-9]\d{9}$` | `Valid Indian mobile number required` |
| `email` | Must equal the signed-in account email | `Email must match the account used to sign in` |
| `termsAccepted` | Must be `true` | `Accept the terms and conditions to continue` |

Other `400`s: `Phone already in use` (number belongs to another account) and `This booking is no longer waiting for the token`. Before paying, re-fetch the booking. Only continue if `status` is `HOLD` or `AWAITING_PAYMENT`; otherwise move the user to the next screen.

**`POST /v1/payments/orders`** now accepts an optional wallet amount:

```json
{ "bookingId": "…", "kind": "TOKEN", "walletPaise": 20000 }
```

If the wallet covers the whole token, the response has `paidInFull: true` and no Razorpay step is needed.

**After the token:** self-drive goes to KYC (`AWAITING_KYC`); other rental types go to `CONFIRMED`. The status change runs in the background a moment after verify, so poll `GET /v1/bookings/:id` rather than assuming it is instant.

---

## 2. Mock (test) payments

Staging and dev run with payments mocked (`PAYMENTS_MOCK=true` or no Razorpay key). Production uses real Razorpay.

- **Before checkout:** `GET /v1/public/config` now returns `"paymentsMock": true | false`. When true, show a "Test mode, no money is charged" note and label the button e.g. "Mock pay ₹500 token".
- **Order response:** `mock: true`, `keyId: "rzp_mock"`, `orderId: "order_mock_…"`. **Do not open Razorpay.** Call verify with only the payment id:

```json
POST /v1/payments/verify
{ "paymentId": "<order.paymentId>" }
```

- When `mock: false`, open Razorpay and send `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature` to verify as before.
- If a mock payment fails, show the API `message` with a "No money was charged" line. Never show a bare "Bad Request".

---

## 3. Readable error messages

Every non-2xx response now has the same human-readable reason in both `message` and `error`:

```json
{ "statusCode": 400, "message": "You must be at least 18 years old", "error": "You must be at least 18 years old" }
```

Show `message` as-is. Never show the HTTP status text ("Bad Request", "Unauthorized").

---

## 4. Forgot / reset password

For customers who sign in with email + password.

| Call | Body | Response |
| --- | --- | --- |
| `POST /v1/auth/password/forgot` | `{ "email" }` | `{ ok, emailSent, queued?, devCode? }`. Emails a 6-digit code |
| `POST /v1/auth/password/reset` | `{ "email", "code", "password" }` | `{ token, user }`. Already signed in; store the token |

Rules: password at least 8 characters; code expires (same as login OTP); limited sends per 15 minutes (`Too many reset requests. Try again in 15 minutes.`) and limited attempts (`Too many attempts. Request a new OTP.`). Unknown email returns `401 No account found with this email`.

Both calls return `403` if password login is switched off in admin (see item 6).

---

## 5. OTP send response

`POST /v1/auth/otp/send` and `POST /v1/auth/password/forgot` return:

```json
{ "ok": true, "emailSent": true, "queued": true, "devCode": "123456" }
```

- `emailSent` — the email was handed to the mail provider.
- `queued` — the mailer was slow, so the API answered within 3 seconds and kept sending in the background. Treat it as sent.
- `devCode` — **only on non-production** (or if the email could not be sent). Show it in debug builds for QA; never rely on it in production.

---

## 6. Login methods controlled from admin

`GET /v1/public/config` now includes:

```json
"auth": {
  "password": true,
  "otp": true,
  "register": true,
  "google": true,
  "facebook": false,
  "otpCreatesAccount": true,
  "socialCreatesAccount": true
}
```

Hide any sign-in button whose flag is `false`. Calling a disabled method returns `403`. When `otpCreatesAccount` is false, OTP only works for existing emails.

Google sign-in is unchanged for the app: `POST /v1/auth/google { idToken }`.

---

## 7. New fields on `GET /v1/me`

| Field | Type | Use |
| --- | --- | --- |
| `dateOfBirth` | `"YYYY-MM-DD"` or `null` | Prefill the token details step |
| `passwordSet` | boolean | Show "Set password" vs "Change password" |
| `nameLocked` | boolean (existing) | `true` after KYC approval. Disable name edits |

Customers get `dateOfBirth` saved automatically after the essentials step.

---

## 8. KYC: Aadhaar front and back

New document kinds for `POST /v1/kyc/uploads`: **`AADHAAR_FRONT`** and **`AADHAAR_BACK`** (`AADHAR_FRONT` / `AADHAR_BACK` spellings are also accepted).

Self-drive KYC is complete when it has all of:

- `DL` (driving licence)
- **Aadhaar** — either both `AADHAAR_FRONT` and `AADHAAR_BACK`, or the old single `AADHAAR`, **or** `ADDRESS` proof
- `SELFIE`

Missing Aadhaar now reads: `Aadhaar front and back, or address proof, is required`. Ask for two photos (front and back) in the app.

---

## 9. Popular getaways on the home payload

`GET /v1/public/home` now includes `getaways` (editable in admin CMS):

```json
"getaways": {
  "enabled": true,
  "eyebrow": "Trip ideas",
  "title": "Popular getaways from",
  "highlight": "Ranchi",
  "lead": "Netarhat, Patratu, and Hundru — …",
  "ctaLabel": "Browse our fleet",
  "ctaHref": "/fleet",
  "guideLabel": "Read the weekend guide",
  "guideHref": "/blogs/weekend-drives-from-ranchi",
  "cards": [
    { "id": "…", "name": "Netarhat", "blurb": "…", "imageUrl": "https://…", "chip": "Weekend", "href": "", "sortOrder": 0, "active": true }
  ]
}
```

Render the section only when `enabled` is true. `href` on a card can be empty.

---

## 10. Availability is city-correct

Search, quotes and bookings now only count vehicles whose branch is in the car's city. If nothing is free you get:

`400 No vehicle available for these dates. Try another car or dates.`

Always send the city with searches. The website now works out the pickup city from the typed address and blocks searches where the address and the chosen city disagree; the app should do the same.

---

## 11. `/health` diagnostics

```json
{ "service": "api", "status": "ok", "redis": "ready", "smtp": "configured", "mailer": "smtp" }
```

`redis: "memory"` or `smtp: "missing"` means degraded but working. Use for diagnostics only; don't gate the app on it.

---

## Web and admin only (no app action)

These shipped in the same period but don't change the customer API:

- Website: mobile nav, hero and search polish; scroll to results after search; live-location pickup; sale popup; animated home sections; logo and photo panel on login; Firebase popup Google sign-in with fallback.
- Website KYC page: preview uploaded documents; success message next to the form; bookings stat jumps to recent trips.
- Website booking timeline: a page per step from the track screen.
- Admin: role-based staff access and staff HR fields, CMS site settings and login toggles, homepage getaways editor, coupons, bookings calendar.
- Backend: Redis and client caching, database indexes for faster catalog queries, Hostinger SMTP with Resend fallback for email, Railway build fixes.

---

## Checklist for the app

- [ ] Call `POST /v1/bookings/:id/essentials` before every TOKEN order, with on-device validation matching item 1.
- [ ] Show the token (`tokenPaise`) as "Pay now" and the rest as "Balance before handover".
- [ ] Support `walletPaise` and `paidInFull`.
- [ ] Handle `mock: true` orders without Razorpay; show the test-mode note when `paymentsMock` is true.
- [ ] Show the API `message` for every error.
- [ ] Add forgot / reset password screens (if password login is offered).
- [ ] Hide login methods that are off in `config.auth`.
- [ ] Prefill DOB from `/v1/me`; respect `nameLocked`.
- [ ] KYC: upload Aadhaar front and back separately.
- [ ] Optional: home getaways section.

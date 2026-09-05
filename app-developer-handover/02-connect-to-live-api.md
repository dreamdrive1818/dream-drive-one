# 2. Connect to the live API

Fill [live-api.config.json](live-api.config.json) and [config.example.env](config.example.env) **before** sharing this pack. The app should not hard-code localhost for a store build.

## Base URLs

| Name | Example | Used for |
| --- | --- | --- |
| `API_BASE_URL` | `https://api.your-domain.com` | All REST |
| `SOCKET_URL` | `https://socket.your-domain.com` | Booking live status |
| Health | `GET {API_BASE_URL}/health` | Connectivity check |

There is **one** public HTTP API. Do not call microservice ports.

Static uploaded files (local fallback): `{API_BASE_URL}/v1/files/...`

## TLS and devices

- Live must be **HTTPS**. Android 9+ and iOS block cleartext HTTP unless you explicitly allow it (do not).
- Physical device + local API: use the machine LAN IP and HTTP only for development.
- Android emulator localhost is `10.0.2.2`, not `127.0.0.1`.
- CORS applies to **web** (Expo web / browsers). Native iOS/Android skip CORS. If you ship Expo web, the API owner must add that origin to `CORS_ORIGINS`.

## Headers (every call)

```http
Content-Type: application/json
Authorization: Bearer <token>     # required except public routes
Accept: application/json
```

Multipart uploads: **do not** set `Content-Type` manually; let the client set the boundary.

Optional (staff web only — ignore in customer app):

- `X-Ops-City-Id`
- `X-Ops-Branch-Id`

Do not send `x-user-id`, `x-email`, `x-firebase-uid`, or `x-internal-token`. The API sets identity from the bearer token.

## Authentication

The API accepts **one** of these as `Authorization: Bearer ...`:

| Token | How the app gets it | Notes |
| --- | --- | --- |
| Session `dd1....` | `POST /v1/auth/otp/verify` or `POST /v1/auth/google` | HMAC session, ~7 days |
| Firebase ID token | `POST /v1/auth/login` or `POST /v1/auth/register` (`token` field) | Same header |
| `dev:email@domain` | Local only | **Disabled in production** |

Store the token securely (Keychain / Keystore / `expo-secure-store`). Send it on every non-public request.

After login, call `GET /v1/me` to load profile. `POST /v1/auth/sync` upserts the user if you already have a Firebase token.

### Public routes (no token)

Anything under `/v1/public/**`, plus:

- `POST /v1/auth/otp/send`
- `POST /v1/auth/otp/verify`
- `POST /v1/auth/login`
- `POST /v1/auth/register`
- `POST /v1/auth/google`
- `POST /v1/webhooks/**` (not for the app)

`GET /health` is public (no `/v1` prefix).

### OTP limits

- Login OTP: **3 sends / 15 minutes / IP**, code valid **5 minutes**, **5 verify attempts**.
- HTTP **429** `{ "error": "Too many OTP requests" }` on `/v1/auth/otp/send`.
- Non-production responses may include `devCode` so QA can log in without mail.

### Suggested client helper

```javascript
const API = process.env.EXPO_PUBLIC_API_URL;

async function api(path, { method = "GET", body, token, isForm } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(isForm ? {} : { "content-type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body == null ? undefined : isForm ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  if (data && data.error && !data.id) {
    const err = new Error(data.error);
    err.status = 400;
    err.data = data;
    throw err;
  }
  return data;
}
```

A few endpoints return `{ error: "..." }` with HTTP 200. Always check `data.error`.

## Error shapes

NestJS (typical):

```json
{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }
```

```json
{ "statusCode": 400, "message": "Quote expired", "error": "Bad Request" }
```

`message` may be a **string or string[]**.

| HTTP | Meaning | App action |
| ---: | --- | --- |
| 200 | Success (still check `error`) | Continue |
| 400 | Validation / business rule | Show `message` on the form |
| 401 | Missing/invalid/disabled token | Clear session → login |
| 403 | Not allowed | “Contact support” |
| 404 | Not found | Empty state |
| 429 | Rate limit | Wait / backoff |
| 5xx | Server | Retry once, then generic error |

**401 `"Account disabled"`** — do not retry; show banned copy.

## Money, time, IDs

- All money is **integer paise**. Display: `₹{(paise / 100).toLocaleString("en-IN")}`.
- Never send rupees. Never round on the client for charging.
- Timestamps are **ISO-8601 UTC**. Display in **Asia/Kolkata**.
- Send pickup/drop as ISO strings (`2026-09-12T10:00:00.000Z` or offset).
- Booking customer-facing id is `publicId` (e.g. `DD-XXXX`). Internal `id` is a cuid. Both work on `GET /v1/bookings/:id`.

## Idempotency (app must follow)

- Creating a booking from the same `quoteId` twice returns the **existing** booking.
- Payment success is confirmed by **webhook**. After Razorpay checkout, poll `GET /v1/payments/:paymentId` until `status` is `SUCCESS` or `FAILED`. Do not mark the booking paid from the SDK callback alone.
- Quotes expire (~**20 minutes**). Holds expire (~**15 minutes**) if unpaid.

## Uploads

| Endpoint | Auth | Max | Types |
| --- | --- | --- | --- |
| `POST /v1/kyc/uploads` | Bearer | 8 MB | PDF, JPG, PNG, WebP |
| `POST /v1/uploads` | Bearer | 8 MB | Cloudinary folders |
| `POST /v1/public/uploads` | Public, rate limited | 8 MB | Testimonials folder only |

KYC kinds: `AADHAAR`, `PAN`, `DL`, `SELFIE`, `ADDRESS`.

Self-drive required: **DL + (Aadhaar or address proof) + selfie with ID**.

## Razorpay

1. `POST /v1/payments/orders` `{ bookingId, kind }` → `{ paymentId, orderId, amountPaise, currency, keyId, mock }`.
2. Open Razorpay Checkout with **that** `keyId`, `orderId`, `amountPaise`.
3. `POST /v1/payments/verify` with Razorpay fields (backup).
4. Poll `GET /v1/payments/:paymentId`.

`kind`: `TOKEN` (default hire token), `BALANCE`, `DEPOSIT`.

If `mock: true`, checkout UI can skip Razorpay and call verify with dummy ids (staging only).

## Socket.IO (optional, with HTTP fallback)

```
io("{SOCKET_URL}/booking", { transports: ["websocket", "polling"] })
emit "booking:subscribe" { bookingId }
on   "booking:status"    { bookingId, publicId, status, reason, at }
```

Always poll `GET /v1/bookings/:id` every ~8s as fallback.

## Firebase (login / Google)

The web Firebase project is the same one the API verifies. Put these in the **app** (they are client keys, not secrets):

See `config.example.env`. Google Sign-In: send the **ID token** to `POST /v1/auth/google`.

## What the API owner must send with this pack

Copy into `live-api.config.json`:

1. HTTPS API base URL and socket URL
2. Whether payments are live Razorpay or mock
3. 2–3 test customer emails (OTP goes to email)
4. At least one published city + car that searches as available
5. Support contact for API downtime
6. Expected CORS origins if Expo web is used

Do **not** send: database URLs, Razorpay secret, Leegality keys, `INTERNAL_TOKEN`, `SESSION_SECRET`, staff admin passwords.

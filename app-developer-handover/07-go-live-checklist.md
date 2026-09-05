# 7. Go-live checklist

Two lists: what **you (API owner)** send, and what the **app developer** must finish.

---

## A. Before you share this folder

- [ ] Live API is HTTPS and `GET /health` returns `{ "status": "ok" }`
- [ ] `live-api.config.json` filled (API URL, socket URL, contacts)
- [ ] `config.example.env` live URLs filled (or a separate private note)
- [ ] CORS includes Expo-web origins **if** they will run in a browser
- [ ] `NODE_ENV=production` so `dev:` tokens and `devCode` are off (or you explicitly keep a **staging** URL with `devCode` for QA)
- [ ] Razorpay: live keys **or** documented mock (`orders.mock === true`)
- [ ] Email OTP actually arrives (Gmail / SMTP)
- [ ] At least one active city, branch, published car, pricing rule
- [ ] One test customer email you both can read
- [ ] Firebase Google Sign-In SHA-1 / iOS client id given to the app team (Play/App store apps)
- [ ] Socket process reachable at `SOCKET_URL` **or** you tell them to poll only
- [ ] You have **not** sent DB passwords, Razorpay secret, Leegality keys, `INTERNAL_TOKEN`

Staging vs production: give the app **staging first**. Switch `EXPO_PUBLIC_API_URL` for store builds.

---

## B. App developer — integration

- [ ] Env points at the URL in `live-api.config.json`
- [ ] Postman: health, OTP, search, quote, booking (against staging)
- [ ] Auth flows: OTP, password, Google
- [ ] Search → quote → book → pay → poll
- [ ] KYC upload + submit + status polling
- [ ] Agreement `signUrl` in-app browser
- [ ] Guest track
- [ ] Cancel + refund copy from API
- [ ] Tickets, invoices PDF, profile, devices
- [ ] Deep links + force update
- [ ] No secrets in the git repo besides Firebase **client** config
- [ ] UAT scenarios in `05-requirement-sheet.md` recorded

---

## C. How to report an API bug

Send:

1. Time (IST)
2. `method` + path (e.g. `POST /v1/bookings`)
3. HTTP status + response body
4. `booking.publicId` or email **without** OTP/password
5. Whether it is staging or live

Do not send bearer tokens in chat.

---

## D. Versioning

- Public contract is `/v1`. Additive fields may appear; do not crash on unknown JSON keys.
- Breaking changes will be a new prefix (`/v2`) or a dated changelog from the API owner.
- Prefer displaying server `message` strings rather than hard-coding every error.

---

## E. Suggested project structure (app)

```
lib/api.ts          # fetch wrapper (token, errors)
lib/money.ts        # paise → ₹
lib/datetime.ts     # UTC → IST
screens/...         # one screen, listed APIs only
```

Do not duplicate `apps/web` Firebase writes. This API is the backend.

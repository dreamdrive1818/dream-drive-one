# Dream Drive — App developer handover

**Product:** Dream Drive car rental (self-drive, with-driver, airport, outstation, one-way, tour, subscription)  
**Audience:** Mobile / frontend app team  
**Backend owner:** Dream Drive API team (this repo: `dream-drive-MS`)  
**API version:** `/v1`  
**Last updated:** 5 Sep 2026

This folder is the **single pack** to share with an app developer when the live API is ready. The app talks **only** to the central API. Pricing, availability, KYC, payments, and booking status are decided on the server.

---

## Who does what

| Role | Owns | Does not own |
| --- | --- | --- |
| **App developer** | Screens, navigation, UI state, form validation UX, Razorpay checkout UI, push token registration, deep links | Business rules, prices, refund math, KYC approval, vehicle assignment |
| **API owner (you)** | Live API, PostgreSQL, Razorpay webhooks, KYC review, Leegality, emails/OTP, admin panel | App store listing, screen design, native UX |

**Rule:** If a number can be money, availability, or a booking status, the app **displays** what the API returns. It never invents or “fixes” those values client-side.

---

## Pack contents

| File | Use it for |
| --- | --- |
| [01-ownership-and-scope.md](01-ownership-and-scope.md) | RACI, in-scope screens, out-of-scope (admin) |
| [02-connect-to-live-api.md](02-connect-to-live-api.md) | Base URL, auth, headers, errors, money, dates, CORS, rate limits |
| [03-api-contract.md](03-api-contract.md) | Every **customer** endpoint: purpose, request, response, errors |
| [04-product-flows.md](04-product-flows.md) | Step-by-step product flows (auth → search → pay → KYC → track) |
| [05-requirement-sheet.md](05-requirement-sheet.md) | Screen-by-screen requirements and acceptance criteria |
| [06-screens-and-api-map.md](06-screens-and-api-map.md) | Which APIs each screen must call |
| [07-go-live-checklist.md](07-go-live-checklist.md) | What you must send them + what they must finish |
| [config.example.env](config.example.env) | Copy into Expo / app env. Fill live URLs before sharing |
| [live-api.config.json](live-api.config.json) | Fill this **before** handing the pack to the app team |
| [postman/DreamDrive-Customer-API.postman_collection.json](postman/DreamDrive-Customer-API.postman_collection.json) | Import in Postman / Thunder Client |
| [DreamDrive-App-Flows.pdf](DreamDrive-App-Flows.pdf) | Printable flow diagrams |

---

## Central API (one URL)

```
HTTPS  {API_BASE_URL}          e.g. https://api.example.com
Prefix /v1
Health GET {API_BASE_URL}/health   →  { "service": "api", "status": "ok" }

Realtime  {SOCKET_URL}/booking     Socket.IO namespace
```

Local defaults (dev only): API `http://localhost:4000`, socket `http://localhost:4010`.

---

## Fast start for the app team

1. Fill / receive [live-api.config.json](live-api.config.json).
2. Import the Postman collection and hit `GET /health`.
3. `POST /v1/auth/otp/send` → `POST /v1/auth/otp/verify` → store `token`.
4. Send `Authorization: Bearer <token>` on every non-public call.
5. Build screens from [06-screens-and-api-map.md](06-screens-and-api-map.md). Follow [04-product-flows.md](04-product-flows.md) in order.

Questions about API behaviour go to the API owner. Questions about layout / navigation stay with the app team.

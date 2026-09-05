# 5. Requirement sheet — customer app

**Product:** Dream Drive  
**Client:** App developer (frontend screens + device UX)  
**Server:** Central `/v1` API (this handover)  
**Platforms:** Android + iOS (Expo acceptable)  
**Language:** English first; IST for all dates

Use this as the UAT checklist. A screen is done only when **API behaviour** matches, not when the layout exists.

---

## 5.1 Cross-cutting requirements

| ID | Requirement | Priority | Acceptance |
| --- | --- | --- | --- |
| C-01 | All money displayed from paise (`/ 100`, `en-IN`) | P0 | No hardcoded ₹ amounts for hire/deposit |
| C-02 | All datetimes shown in IST | P0 | Quote start/end match API ISO after timezone convert |
| C-03 | Bearer token on every non-public call | P0 | 401 → login; disabled account copy |
| C-04 | Secure token storage | P0 | Not in AsyncStorage plaintext on production builds |
| C-05 | HTTPS live API | P0 | Store builds never point at localhost |
| C-06 | Offline / 5xx / timeout UI | P0 | Retry on splash and checkout |
| C-07 | No client-side price or availability “override” | P0 | Search `available: false` not bookable |
| C-08 | Payment success only after poll SUCCESS | P0 | Kill-app during Razorpay still ends correct after reopen |
| C-09 | Deep links `dreamdrive://bookings/:id` and `://track/:publicId` | P1 | Cold start opens the right screen |
| C-10 | Register push token after login | P1 | `POST /v1/me/devices` |
| C-11 | Force-update gate vs `EXPO_PUBLIC_MIN_APP_VERSION` | P1 | Old build blocked with store link |
| C-12 | Accessibility: 44pt targets, labels on inputs | P2 | TalkBack/VoiceOver on login + checkout |
| C-13 | Do not log tokens, OTP, Aadhaar, PAN | P0 | Crash reports redacted |

---

## 5.2 Screen requirements

| ID | Screen | Must do | APIs | Done when |
| --- | --- | --- | --- | --- |
| S-01 | Splash | Hit health; restore token; force-update | `GET /health` | Opens home or login in < 3s on good network |
| S-02 | Login OTP | Email + 6-digit code; resend respects 429 | `otp/send`, `otp/verify` | Token stored; lands on home |
| S-03 | Login password | Email + password | `auth/login` | Same as S-02 |
| S-04 | Register | Name, email, password ≥ 8 | `auth/register` | Profile `fullName` set |
| S-05 | Google | Native Google ID token | `auth/google` | Same as S-02 |
| S-06 | Home | Banners, featured cars, call/WhatsApp | `public/home` or `public/config` + search | Taps open search/detail |
| S-07 | Search form | City, dates, rental type | `public/cities`, `public/catalog-config` | Invalid range blocked using `maxDaysByType` |
| S-08 | Results | Filters, sort, availability badge | `public/search` | Unavailable cars not checkout-able |
| S-09 | Car detail | Gallery, specs, calendar busy days | `cars/:slug`, `availability` | Busy days not selectable |
| S-10 | Airport extras | Terminal, flight, wait | `public/airports` | Quote includes `terminalId` |
| S-11 | Checkout | Line items from quote only | `POST/GET quotes`, `apply-offer` | Offer failure shows API message |
| S-12 | Create booking | Hold vehicle | `POST /v1/bookings` | Shows `publicId` + pay CTA + hold timer |
| S-13 | Pay | Razorpay with server `keyId`/`orderId`/`amountPaise` | `payments/orders`, `verify`, `GET payments/:id` | Booking status advances without client guess |
| S-14 | Pay fail | Retry / new order | same | Duplicate success does not double-charge (server idempotent) |
| S-15 | KYC | DL + Aadhaar/address + selfie; kinds enum | `kyc/uploads`, `kyc/submit`, `me/kyc` | 400 messages shown; reusable path works |
| S-16 | Agreement | PDF + open `signUrl` | `me/agreements` | Status SIGNED only after API says so |
| S-17 | Bookings list | All statuses, pull to refresh | `me/bookings` | Empty state if none |
| S-18 | Booking detail | Timeline, driver, pay/KYC/sign CTAs by status | `bookings/:id` + socket | Cancel hidden after handover |
| S-19 | Guest track | publicId + phone OTP | `track/otp`, `track/verify` | Wrong phone shows API error |
| S-20 | Cancel | Policy copy + confirm | `bookings/:id/cancel` | Shows returned `refundPct` |
| S-21 | Profile | Name lock after KYC; phone OTP | `GET/PATCH /v1/me`, `phone/verify`, addresses | Name edit disabled when `nameLocked` |
| S-22 | Invoices | List + download PDF | `me/invoices`, `.../pdf` | PDF opens |
| S-23 | Wallet | Balance + txns | `me/wallet` | Read-only |
| S-24 | Tickets | Create, thread, closed = no reply | `me/tickets*` | Staff replies visible |
| S-25 | Packages | List + itinerary + book | `public/packages` | Quote with `packageId` |
| S-26 | Subscriptions | Plans + subscribe | `public/subscriptions/plans`, `POST /v1/subscriptions` | Enters payment flow |
| S-27 | Contact | Name + email or phone | `public/contact` | Success toast |
| S-28 | Legal | CMS pages | `public/pages/:slug` | Terms/privacy before register |
| S-29 | Review | After COMPLETED | `POST /v1/reviews` | “Pending approval” copy |
| S-30 | Notifications | List / open booking | devices + OS notifications | Tap opens S-18 |

---

## 5.3 Validation (mirror API; API still wins)

| Field | Rule |
| --- | --- |
| Email | Required for auth |
| Password | ≥ 8 characters |
| Phone | Indian `^[6-9]\d{9}$` |
| OTP | 6 digits, 5 minute TTL |
| Dates | `from` < `to`, not in the past, ≤ `maxDaysByType` |
| KYC files | PDF/JPG/PNG/WebP, ≤ 8 MB |
| Aadhaar | 12 digits |
| PAN | `ABCDE1234F` |
| Self-drive docs | DL + (Aadhaar or ADDRESS) + SELFIE |
| Ticket | subject + body required |
| Review rating | 1–5 integer |

---

## 5.4 Non-functional

| Area | Target |
| --- | --- |
| Splash → home | < 3s on 4G with warm cache |
| Search results | Skeleton then data; no blank white screen |
| Checkout | Disable double-tap on Pay / Book |
| Images | Use API image URLs; lazy load |
| Analytics | Optional; do not block booking if analytics fails |

---

## 5.5 Explicit non-requirements

- Admin, fleet handover photos, partner ledger
- Changing prices or unlocking unavailable cars
- SMS OTP for login (email OTP is the API today; guest track uses phone OTP)
- Wallet top-up
- In-app chat other than tickets
- Multi-language (unless later agreed)

---

## 5.6 UAT scenarios (API owner + app)

1. New user OTP → search Ranchi self-drive → quote → pay mock/live → KYC → see `AWAITING_SIGNATURE` or `CONFIRMED`.
2. Kill app on Razorpay success page → reopen → booking not stuck on unpaid if webhook succeeded.
3. Let quote expire → booking create fails → user can requote.
4. Cancel > 48h before self-drive start → `refundPct` 100.
5. Guest track with wrong phone → error; correct phone → booking visible.
6. Approved KYC reuse on second booking.
7. Ticket on a booking → admin reply appears in app.
8. Google login on a real device.
9. Deep link to booking while logged out → login then land on booking.
10. Airplane mode on pay → user sees error, can retry order.

---

## 5.7 Deliverables from the app team

- Store-ready Android + iOS builds pointing at **live** `EXPO_PUBLIC_API_URL`
- Screen recording of UAT 1–10
- List of API bugs (status, path, request id/time) vs UI bugs
- Push notification screenshots (once FCM is configured)

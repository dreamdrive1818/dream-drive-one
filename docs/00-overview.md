# Dream-Drive — Product & technical overview

**For:** client walkthrough and developer onboarding  
**Product:** car rental platform — search, book, KYC, pay, e-sign, track  
**Architecture:** NestJS API (port 4000) + Next.js web/admin + Expo mobile

## What the customer gets

A customer can find a car, see if it is free for their dates, book self-drive or with-driver (local, airport, outstation, one-way, tour, subscription), pay a token and security deposit on Razorpay, complete KYC, sign the rental agreement on Leegality, and track the booking on web or mobile.

## What admin gets

One admin console to run multi-city / multi-branch operations: users, fleet, bookings, partners, finance, KYC, agreements, offers, leads, and reports. Partners do **not** get a portal — staff manage partner cars, commissions, and settlements.

## What we are replacing

Today the live site writes Firestore from the browser. OTP, confirmation mail, and Zoho webhooks sit on a small Express app. That does not scale to payments, e-sign, availability, or multi-branch ops.

This rebuild puts **all business rules on the server**. Firebase Auth stays for login. PostgreSQL becomes the system of record.

## Microservice map (client-friendly)

| Service | In plain language | Why it is separate |
| --- | --- | --- |
| Gateway | Front door of the API | One URL, auth, rate limits |
| Identity | Who is logged in, and their role | Security changes without touching bookings |
| Catalog | Which cars exist and if they are free | Search can scale independently |
| Booking | Creating and running a rental | Core money path |
| Payments | Razorpay, invoices, deposits, wallet | PCI-adjacent; webhooks are noisy |
| Documents | KYC, Zoho forms, Leegality, PDFs | External vendors fail independently |
| Fleet | Physical cars, workshop, handover, drivers | Ops can go down without blocking browse |
| Partners | Owner cars, commission, payouts | Ledger isolation |
| Notifications | Email (SMS/WhatsApp later) | Retry/queue without blocking checkout |
| Platform | Website CMS, CRM, offers, reviews, finance reports | Lower-risk growth features |

## MVP vs later

**MVP (first 4 weeks of build):** identity, catalog search, self-drive + with-driver booking, Razorpay token, KYC + Zoho ingest, Leegality handshake, email OTP/confirmation, admin bookings/cars/users, booking tracking.

**After MVP:** subscription, airport/tour packages, maintenance, handover inspections, drivers, partner settlements, wallet/loyalty, support desk, mobile app store release, finance packs.

## Confirmed exclusions

- Delivery / pickup executive app
- Partner self-service portal

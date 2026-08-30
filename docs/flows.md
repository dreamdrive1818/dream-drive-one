# Lifecycle flows

## Booking lifecycle

```
DRAFT (quote)
  → HOLD (vehicle locked 15 min)
  → AWAITING_PAYMENT (Razorpay order)
  → AWAITING_KYC          [self-drive]
  → AWAITING_SIGNATURE    [self-drive]
  → CONFIRMED
  → HANDOVER
  → ONGOING
  → RETURN_PENDING
  → COMPLETED
Cancel possible until HANDOVER (policy + refunds).
NO_SHOW if not handed over within grace.
```

Events: `booking.hold.created` `booking.confirmed` `booking.cancelled` `booking.completed`  
Consumers: catalog (availability), notification, payment (deposit schedule), partner (ledger on complete), platform (review invite).

## Payment lifecycle

```
Quote freeze
  → payment-service creates Razorpay order (TOKEN)
  → customer checkout
  → webhook payment.captured  OR  client verify as backup
  → Payment SUCCESS (idempotent)
  → invoice TOKEN issued
  → booking status advances
Balance: before handover.
Deposit: authorize/capture per city policy.
Refund: finance only; Razorpay refund id stored.
```

Never advance booking on client “success” page alone — webhook is source of truth; success page polls `/v1/payments/:id`.

## KYC and Leegality signing

```
Customer submits docs (app)  OR  Zoho Form webhook
  → KycCase SUBMITTED
  → admin APPROVED / REJECTED
  → if APPROVED and booking AWAITING_KYC
       document-service generates PDF from template
       create Leegality envelope
       customer signs
       webhook envelope.completed
       store signed PDF
       booking → CONFIRMED
```

## Zoho Form → Leegality

This is the **current production path**, preserved:

1. Customer pays token on site (or admin sends Zoho form).
2. Zoho Form submit (personal info, address, booking, Aadhaar/DL numbers, files).
3. `POST /v1/webhooks/zoho-form` (document-service).
4. Upsert `User` + `KycCase` + `ZohoSubmission`; download attachments → Cloudinary.
5. If a matching `Booking` exists (email + dates + car), attach KYC to it.
6. If KYC auto-complete rules pass (or admin approves), generate agreement and send Leegality.
7. Signed artifact stored; booking CONFIRMED.

Deduplicate bookings the same way today’s webhook does (dates + car + pickup + token fields).

## Multi-city booking

1. Search requires `cityId`.
2. Vehicles filtered to that city’s branches (one-way: pickup city vehicles; drop city recorded).
3. Pricing: city rules + city-pair one-way fee.
4. Staff see only their `StaffScope`.
5. On return of one-way, fleet-service updates `Vehicle.branchId` to drop branch (or creates a transfer job).

## Partner settlement and ledger

```
Booking COMPLETED
  → partner-service: LedgerEntry TRIP_EARNING (gross)
  → LedgerEntry COMMISSION (frozen rule)
  → net = earning - commission - penalties
Nightly/weekly: generate Settlement for period
Finance reviews → mark-paid (UTR)
Partner vehicles with open DamageCharge are excluded from that line.
```

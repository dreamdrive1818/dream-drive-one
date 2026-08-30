# 6. Payments, invoicing & security deposits

## Feature purpose

Collect token (advance), remaining rental, and refundable security deposit via Razorpay. Issue invoices. Track deposit hold/release.

## Customer-side actions

- Pay token at checkout
- Pay remaining balance before handover (or at branch — admin marks collected)
- Pay / authorize security deposit
- Download invoice / receipt
- See refund status

## Admin-side actions

- Record offline cash/UPI
- Capture or void deposit
- Issue refund (partial/full)
- Mark invoice paid
- Reconcile Razorpay settlements

## Backend APIs

| Method | Route | Service |
| --- | --- | --- |
| POST | `/v1/payments/orders` | payment — creates Razorpay order |
| POST | `/v1/payments/verify` | payment — signature check |
| POST | `/v1/webhooks/razorpay` | payment |
| GET | `/v1/me/invoices` | payment |
| POST | `/v1/admin/payments/:id/refund` | payment |
| POST | `/v1/admin/deposits/:id/capture` | payment |
| POST | `/v1/admin/deposits/:id/release` | payment |
| POST | `/v1/admin/payments/offline` | payment |

## Database

`Payment`, `PaymentAttempt`, `Invoice`, `InvoiceLine`, `SecurityDeposit`, `Refund`, `PayoutReconciliation`

Payment kinds: `TOKEN`, `BALANCE`, `DEPOSIT`, `EXTRA`, `PENALTY`

## Validations

- Never trust client amount — server recomputes from Quote/Booking
- Razorpay webhook signature required
- Idempotent webhook handling (`eventId` unique)
- Deposit release only after return inspection closed (fleet event)
- GST fields on invoice (CGST/SGST or IGST by state)

## RBAC

CUSTOMER: own pay + download. FINANCE + SUPER_ADMIN: refunds. BRANCH: record offline only for own branch.

## Business benefit

Replaces “token_amount_paid” text fields from Zoho with a ledger.

## Priority / complexity

**P0 for token + webhook. P1 for deposit capture and GST invoices. Complexity: L.**

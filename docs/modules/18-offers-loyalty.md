# 18. Offers, loyalty, referral & wallet

**Status: ✅ Implemented**

## Feature purpose

Discount codes, referral credit, simple loyalty points, wallet balance used at checkout.

## Customer-side actions

- Apply coupon on quote (`POST /v1/quotes/:id/apply-offer`) — floor price enforced
- Share / claim referral code (`POST|GET /v1/me/referrals`, `POST /v1/me/referrals/claim`)
- See points / wallet (`GET /v1/me/loyalty`, `GET /v1/me/wallet`, `/account/wallet`)
- Pay part (or all) of token from wallet on `/checkout/pay`

## Admin-side actions

- CRUD offers: create + list + PATCH freeze/disable, city, product (`rentalType`), min days, usage cap (`/offers`)
- Adjust wallet credit/debit with reason (`POST /v1/admin/wallets/:userId/adjust` on customer detail)
- Freeze abusive codes (`active: false`)

## Backend APIs

```
POST /v1/quotes/:id/apply-offer
GET  /v1/me/wallet
GET  /v1/me/loyalty
GET|POST /v1/me/referrals
POST /v1/me/referrals/claim
POST /v1/payments/orders  (optional walletPaise)
GET  /v1/admin/offers
GET  /v1/admin/offers/:id
POST /v1/admin/offers
PATCH /v1/admin/offers/:id
POST /v1/admin/wallets/:userId/adjust
POST /internal/loyalty/booking-completed
```

Wallet lives in **payment**; offers/loyalty/referral in **platform**. Quote engine validates offers (window, active, city, product, min days, caps, floor). On booking **COMPLETED**, loyalty points earn and first-trip referral wallet credit run.

## Database

| Model | Status |
|---|---|
| `Offer` | ✅ Enhanced — `cityId`, `rentalType`, `minDays`, `active`, timestamps |
| `OfferRedemption` | ✅ |
| `Wallet` / `WalletTxn` | ✅ + admin adjust + checkout debit |
| `LoyaltyAccount` / `LoyaltyTxn` | ✅ Earn on COMPLETED |
| `Referral` | ✅ `refereeId`, `creditedAt`, `creditPaise` |
| `PaymentKind.WALLET` | ✅ New |

## Validations

- Coupon unique; date window; max redemptions; one per user; freeze via `active`
- Discount never below floor (max of ₹1 and 10% of gross)
- Wallet cannot go negative
- Referral credit only after referee’s first COMPLETED booking (₹200)

## RBAC

CUSTOMER: redeem / wallet pay / referral. SALES: create/freeze offers. FINANCE: wallet adjust.

## Business benefit

Campaigns without code deploys.

## Priority / complexity

**P1 coupons. P2 wallet/loyalty/referral. Complexity: M.**

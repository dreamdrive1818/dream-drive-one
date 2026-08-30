# 18. Offers, loyalty, referral & wallet

## Feature purpose

Discount codes, referral credit, simple loyalty points, wallet balance used at checkout.

## Customer-side actions

- Apply coupon on quote
- Share referral code
- See points / wallet
- Pay part of token from wallet

## Admin-side actions

- CRUD offers (percent/flat, city, product, min days, usage cap)
- Adjust wallet (credit/debit with reason)
- Freeze abusive codes

## Backend APIs

`POST /v1/quotes/:id/apply-offer`  
`GET /v1/me/wallet`  
`GET /v1/me/loyalty`  
`POST /v1/me/referrals`  
Admin CRUD `/v1/admin/offers`

Wallet lives in **payment-service**. Offers/loyalty in **platform-service**; quote engine asks platform to validate then booking stores `offerId` + frozen discount.

## Database

`Offer`, `OfferRedemption`, `Wallet`, `WalletTxn`, `LoyaltyAccount`, `LoyaltyTxn`, `Referral`

## Validations

- Coupon unique; date window; max redemptions per user
- Wallet cannot go negative
- Referral credit only after referee’s first COMPLETED booking
- Discount never below floor price

## RBAC

CUSTOMER: redeem. SALES: create offers. FINANCE: wallet adjust.

## Business benefit

Campaigns without code deploys.

## Priority / complexity

**P1 coupons. P2 wallet/loyalty/referral. Complexity: M.**

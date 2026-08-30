# 22. Customer mobile app — Android & iOS

## Feature purpose

Expo app covering login, browse, book, profile, KYC upload, pay, track. Same gateway APIs as web — no second backend.

## Customer-side actions (screens)

1. Splash / force-update
2. Login / OTP
3. Home + search
4. Car detail + calendar
5. Quote / checkout
6. Razorpay checkout
7. KYC upload
8. Agreement (open Leegality)
9. My bookings + tracking
10. Profile
11. Support ticket
12. Notifications list

## Admin-side actions

- None in this app
- Admin may send push copy via notification templates later

## Backend APIs

Reuse `/v1/*`. Extra: `POST /v1/me/devices` for FCM push tokens.

## Database

`DeviceToken` on identity.

## Validations

- Pinning min app version
- Same amount/availability rules as web
- Deep link `dreamdrive://bookings/:id`

## RBAC

CUSTOMER only.

## Business benefit

Store presence; same business rules as website.

## Priority / complexity

**P2 after web checkout is stable. Complexity: L** (store review, payments on mobile).

## Note

Do not start Expo until booking + payment + KYC work on web. Duplicate UI with a broken API wastes the sprint.

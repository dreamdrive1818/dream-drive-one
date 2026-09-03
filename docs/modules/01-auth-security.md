# 1. Core architecture, auth & security baseline

## Feature purpose

Give every app (website, admin, mobile) one secure way to call the platform. Verify Firebase tokens at the gateway, sync users into PostgreSQL, and enforce roles on every write.

## Customer-side actions

- Sign up / sign in with Firebase (email-password, later Google)
- Verify email via OTP (notification-service)
- Refresh session; sign out
- Cannot hit admin routes

## Admin-side actions

- Invite staff, assign roles (super admin, city manager, branch manager, fleet, finance, sales, support)
- Disable a user
- View audit log of privileged actions

## Backend APIs

| Method | Route | Service |
| --- | --- | --- |
| POST | `/v1/auth/sync` | identity — upsert PG user from Firebase / session token |
| POST | `/v1/auth/login` | Firebase email + password → ID token |
| POST | `/v1/auth/register` | Firebase email + password sign-up |
| POST | `/v1/auth/google` | Google / Firebase ID token → session |
| POST | `/v1/auth/otp/send` | email OTP (Postgres, 5 min TTL, 3 / 15 min) |
| POST | `/v1/auth/otp/verify` | verify OTP and mint session token |
| GET | `/v1/me` | identity |
| PATCH | `/v1/me` | identity |
| GET | `/v1/admin/users` | identity |
| POST | `/v1/admin/users/invite` | identity — create/assign staff |
| PATCH | `/v1/admin/users/:id/roles` | identity |
| POST | `/v1/admin/users/:id/disable` | identity |
| GET | `/v1/admin/audit` | identity |

Gateway verifies `Authorization: Bearer <Firebase ID token | dd1 session | dev:email>` on all `/v1/*` except public catalog, auth login/OTP/register/google, and webhooks. `/v1/admin/*` is staff-only. Dev bypass is off in production.

## Database (identity schema)

- `User` — firebaseUid, email, phone, status
- `Role`, `UserRole`
- `CustomerProfile` — name, default city, KYC status denormalized
- `Address`
- `AuditLog` — actorId, action, entity, payload, ip

## Validations

- Token must be a valid Firebase ID token for this project
- Email unique; phone unique when present
- Super-admin role cannot be removed from the last remaining super admin
- Webhooks use HMAC secrets, not user tokens

## Role-based access

| Role | Scope |
| --- | --- |
| CUSTOMER | own profile only |
| SUPPORT | read users, bookings; no finance payouts |
| SALES | leads + bookings create/assist |
| FLEET_OPS | fleet, maintenance, handover, drivers |
| FINANCE | payments, invoices, settlements, reports |
| BRANCH_MANAGER | own branch |
| CITY_MANAGER | all branches in city |
| SUPER_ADMIN | all |

## Business benefit

Stops the current pattern of the browser writing Firestore. Security and audit become real.

## Priority / complexity

**P0 — MVP. Complexity: M.**

# Security checklist

- [ ] Firebase ID tokens verified on gateway with project certs; clock skew handled
- [ ] Browser never holds Razorpay secret, Firebase Admin key, Zoho/Leegality keys, or Prisma
- [ ] Firestore **not** used as system of record in this stack
- [ ] RBAC on every mutating route; branch scope on list queries
- [ ] Webhooks: Razorpay HMAC, Zoho secret, Leegality signature/allowlist
- [ ] Idempotency keys on payment webhook and booking create
- [ ] OTP in Redis TTL 5 min; rate limit per email/IP
- [ ] Aadhaar/PAN stored hashed or vaulted; logs redacted
- [ ] Signed upload URLs expire in minutes; MIME allowlist
- [ ] CORS allowlist web + admin + mobile schemes
- [ ] Helmet, body size limits, Prisma parameterized queries
- [ ] Audit log for refunds, KYC decisions, role changes, settlement pay
- [ ] Secrets in env / secret manager, never git
- [ ] TLS everywhere in prod; internal services not on public IPs
- [ ] Dependency scanning on CI

# Deployment checklist

**Environments:** `dev` → `staging` → `prod`

- [ ] Postgres 16 + Redis
- [ ] `prisma migrate deploy` per release
- [ ] One container per service + gateway (Cloud Run / Fly / ECS / Render)
- [ ] Gateway is the only public API
- [ ] `NEXT_PUBLIC_API_URL` per environment
- [ ] Firebase Auth authorized domains
- [ ] Razorpay webhook URL + secret rotated
- [ ] Zoho form webhook retargeted from old Render Express to document-service
- [ ] Leegality callback URL
- [ ] Cloudinary preset unsigned **disabled**; use signed
- [ ] Email OAuth refresh token valid
- [ ] Health checks + structured logs + error tracking (Sentry)
- [ ] Backups: Postgres daily, retain 14 days
- [ ] Runbook: webhook replay, HOLD sweeper, failed notify retry
- [ ] Mobile: TestFlight / Play internal before store

## Cutover from current stack

1. Dual-write Zoho webhook to old Express **and** document-service for 1 week.
2. Freeze new Firestore order writes; read old orders as imported `Booking` rows.
3. Point `client-main` at gateway only after web MVP ships — or ship `apps/web` as the new site.
4. Keep Gmail OTP templates visually consistent with current mail.

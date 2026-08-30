# 17. Finance, accounting & reports

## Feature purpose

GST-ready invoices, collections vs Razorpay, outstanding balances, deposit liability, partner payouts, P&L-lite by city.

## Customer-side actions

- Download tax invoice

## Admin-side actions

- Date-range reports: bookings, revenue, refunds, deposits outstanding
- Export CSV
- Mark GST invoice series
- View Razorpay vs internal mismatch queue

## Backend APIs

`GET /v1/admin/reports/revenue`  
`GET /v1/admin/reports/bookings`  
`GET /v1/admin/reports/deposits`  
`GET /v1/admin/reports/partners`  
`GET /v1/admin/reports/gst`

Implemented in **platform-service** reading payment + booking + partner via internal APIs (no giant join across writes).

## Database

Reads `Payment`, `Invoice`, `Refund`, `SecurityDeposit`, `Settlement`. Optional `ReportSnapshot` nightly.

## Validations

- Reports timezone IST
- Finance role required
- Exports audited

## RBAC

FINANCE, SUPER_ADMIN. CITY_MANAGER: own city revenue only.

## Business benefit

Replace spreadsheet recon.

## Priority / complexity

**P2 (basic CSV in P1). Complexity: M–L.**

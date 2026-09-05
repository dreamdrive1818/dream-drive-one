# 17. Finance, accounting & reports

## Feature purpose

GST-ready invoices, collections vs Razorpay, outstanding balances, deposit liability, partner payouts, P&L-lite by city.

## Customer-side actions

- Download tax invoice (GST breakdown on `/account/invoices`)

## Admin-side actions

- Date-range reports (IST): bookings, revenue, refunds, deposits outstanding
- Export CSV (audited)
- Mark GST invoice series (prefix, FY, next number, GSTIN)
- View Razorpay vs internal mismatch queue

## Backend APIs

`GET /v1/admin/reports/revenue`  
`GET /v1/admin/reports/bookings`  
`GET /v1/admin/reports/deposits`  
`GET /v1/admin/reports/partners`  
`GET /v1/admin/reports/gst`  
`GET /v1/admin/reports/mismatch`  
`GET /v1/admin/reports/:kind/export` — CSV, writes `finance.report.export` audit  
`GET /v1/admin/finance/invoice-series`  
`PUT /v1/admin/finance/invoice-series`  
`POST /internal/reports/snapshot` — nightly IST totals

Query: `from`, `to` as `YYYY-MM-DD` in Asia/Kolkata. Optional `cityId` for FINANCE / SUPER_ADMIN.

Implemented in **apps/api** platform finance module, reading payment + booking + partner tables (no giant join across writes). Worker snapshots previous IST day at 00:30.

## Database

Reads `Payment`, `Invoice`, `Refund`, `SecurityDeposit`, `Settlement`, `PayoutReconciliation`.  
Writes `InvoiceSeries` (GST numbering), `ReportSnapshot` (nightly).

## Validations

- Reports timezone IST
- Finance role required (CITY_MANAGER: own city revenue/bookings/deposits/GST only)
- Exports audited
- GSTIN 15 alphanumeric when marked

## RBAC

FINANCE, SUPER_ADMIN. CITY_MANAGER: own city revenue only. Mark series: FINANCE + SUPER_ADMIN.

## Business benefit

Replace spreadsheet recon.

## Priority / complexity

**P2 (basic CSV in P1). Complexity: M–L.**

# Screens and admin pages

## Public website (`apps/web`)

- `/` Home
- `/cars` Search / fleet
- `/cars/[slug]` Detail + availability
- `/packages` Tour packages
- `/packages/[slug]` Itinerary + book CTA
- `/blogs`, `/blogs/[slug]`
- `/contact`
- `/track/[bookingId]` (also logged-out with id + phone OTP)
- `/legal/*` CMS pages
- `/login`
- `/checkout/[quoteId]`
- `/checkout/pay`
- `/checkout/success`

## Customer dashboard (`apps/web`)

- `/account`
- `/account/bookings`
- `/account/bookings/[id]`
- `/account/kyc`
- `/account/agreements`
- `/account/invoices`
- `/account/wallet`
- `/account/tickets`

## Admin panel (`apps/admin`)

- `/login`
- `/` Dashboard (KPIs)
- `/bookings`, `/bookings/[id]`
- `/cars` (models), `/vehicles`
- `/availability`
- `/customers`
- `/kyc`
- `/agreements`
- `/payments`, `/invoices`, `/deposits`
- `/drivers`
- `/maintenance`
- `/inspections`
- `/partners`, `/partners/[id]/ledger`, `/settlements`
- `/cities`, `/branches`, `/staff`
- `/offers`, `/cms`, `/blogs`, `/banners`, `/media`
- `/packages` (tours, city pairs, airports)
- `/leads`, `/tickets`, `/reviews`
- `/reports/revenue`, `/reports/gst`
- `/notifications`

No partner portal routes.

## Mobile (`apps/mobile`)

1. Splash  
2. Login / OTP  
3. Home  
4. Search results  
5. Car detail  
6. Checkout  
7. Razorpay  
8. KYC  
9. Booking list  
10. Booking tracking  
11. Profile  
12. Tickets  
13. Notifications  

## Roles vs admin pages

| Page | Roles |
| --- | --- |
| Dashboard | all staff |
| Bookings | SALES, SUPPORT, FLEET, managers |
| Vehicles / maintenance / handover / drivers | FLEET, BRANCH, CITY |
| KYC / agreements | SUPPORT, SALES, SUPER_ADMIN |
| Payments / settlements / reports | FINANCE, SUPER_ADMIN |
| CMS / offers | SALES, SUPER_ADMIN |
| Staff / cities | SUPER_ADMIN, CITY_MANAGER |

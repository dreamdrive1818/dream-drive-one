# 2. Public website enhancement & CMS

## Feature purpose

Marketing site that admin can update without a deploy: home, fleet highlights, blogs, banners, SEO metadata, contact, offers strip.

## Customer-side actions

- Browse home, fleet teaser, blogs, contact, FAQs
- Open enquiry / WhatsApp CTA
- See active banners and monsoon/sale strips (CMS-driven)

## Admin-side actions

- CRUD pages, banners, blogs, categories, media, page metadata
- Publish / unpublish
- Manage testimonials shown on home

## Backend APIs

| Method | Route | Service |
| --- | --- | --- |
| GET | `/v1/public/pages/:slug` | platform |
| GET | `/v1/public/banners` | platform |
| GET | `/v1/public/blogs` | platform |
| GET | `/v1/public/blogs/:slug` | platform |
| POST | `/v1/public/contact` | platform (creates CRM lead too) |
| CRUD | `/v1/admin/cms/*` | platform |

## Database

`CmsPage`, `Banner`, `BlogPost`, `BlogCategory`, `BlogComment`, `MediaAsset`, `PageMetadata`, `Testimonial`

## Validations

- Slug unique; published content must have meta title/description
- Comments require auth or moderation flag
- Media MIME + size limits

## RBAC

Public read published only. Admin: SUPER_ADMIN, SALES (blogs), SUPPORT (comments).

## Business benefit

Stops hardcoding promo UI in React (current monsoon bar). Marketing can ship campaigns.

## Priority / complexity

**P1 — early MVP for home/banners. Complexity: S–M.**

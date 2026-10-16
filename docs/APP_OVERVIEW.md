# Flowers N Plants — App Overview

B2B florist and plant storefront with an admin panel, for offices in Dubai, Abu Dhabi and Sharjah (UAE). All product content (products, prices, images, details) is managed by admins in the database. Nothing is hardcoded.

## 1. Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 (CSS-based `@theme`, no `tailwind.config.js`) |
| Fonts | Geist, Geist Mono, IBM Plex Sans Arabic (Arabic only) |
| Database | MySQL 8.4 on the VPS (127.0.0.1 only), Drizzle ORM + `drizzle-kit` migrations |
| Auth | Self-hosted: admins = Argon2id password + TOTP MFA; customers = email OTP; DB-backed sessions |
| Images | Cloudflare R2, presigned uploads, `sharp` re-encode to WebP, custom media domain |
| Email | Brevo transactional API |
| i18n | next-intl, `en` / `ar`, path-prefixed, full RTL |
| Payments | Stripe (Checkout, Payment Links, webhooks); COD live; Tabby/Tamara scaffolded |
| Deploy | Hostinger Ubuntu VPS: Nginx + systemd, release dirs + symlink (`docs/DEPLOYMENT.md`) |
| Backups | daily mysqldump → restic (encrypted) → offsite; restore drills; monitoring timer |

See `CLAUDE.md` for the file-level map and the security rules, and `docs/MIGRATION.md` for what changed from the Supabase build.

## 2. Architecture

```
Browser ─► Nginx ─► Next.js (systemd) ─► MySQL (localhost)
                          ├─► R2 (media)   ├─► Stripe (+ signed webhook)   └─► Brevo (email)
src/proxy.ts: next-intl locale routing only (skips /admin)
```

## 3. Storefront (`src/app/[locale]/`)

Routes: `/` home, `/shop`, `/shop/[category]`, `/products/[slug]`, `/cart`, `/checkout`, `/order-confirmation/[token]`, `/setups`, `/corporate`, `/offers`, `/blog`, `/blog/[slug]`, `/account`, `/account/sign-in`.

- **Cart**: client-only (`localStorage`), no cart table. It only becomes data when placed as an order. It is cleared on the confirmation page so a cancelled Stripe checkout keeps the cart.
- **Pricing**: all math goes through `priceLine()` / `getEffectivePrice()` in `src/lib/pricing.ts`. Rules cover min quantity, min order value, glass vessel + refundable deposit, and monthly rental + deposit. VAT is 5%, and deposits sit outside the VAT base.
- **Leads**: enquiry forms call the `createLead` action (Zod-validated, rate-limited).
- **Account**: email one-time code (Brevo), no passwords. Verifying the code creates or reuses the `customers` row for that email, so guest orders appear in the account.
- **SEO**: JSON-LD (Organization, LocalBusiness, Product/Offer, BreadcrumbList, FAQPage), canonical + hreflang, sitemap/robots, ISR (`revalidate = 300`) via `setRequestLocale`.
- **Localization**: UI strings in `messages/en.json` and `ar.json`. Product/category Arabic text is in `*_ar` columns with English fallback (`lib/data/localize.ts`). Enum values (emirates, frequencies) are stored in English and translated only for display.
- **Design**: warm palette, gold accent, serif headings, Geist Mono labels. Use logical Tailwind properties (`start-*`/`end-*`/`ms-*`) for RTL.

## 4. Admin (`src/app/admin/`)

English only, with its own root layout. The auth gate is in `(dashboard)/layout.tsx`, and `/admin/login` sits outside it.

Sections: Dashboard (hand-rolled SVG charts), Products (form with live `ProductCard` preview and image upload), Categories, Orders, Offers, Payment Links, CRM (leads Kanban), Blog CMS, Customers, Reports (CSV export), Settings (store settings, staff & roles).

Roles (`src/lib/admin/roles.ts`, enforced by `authorize()`):
- **owner**: everything, including staff and payment links.
- **manager**: catalog, offers, blog, reports.
- **staff**: orders, leads, customers.

Every admin server action and mutating route handler must start with `authorize(...)`. Sign-in needs password + (once enrolled) a TOTP code; enrol under Admin > Account. Create an admin with `npm run admin:create` (see `.env.example` / `docs/DEPLOYMENT.md`).

## 5. Data layer (`drizzle/`, `src/lib/db/schema.ts`)

Tables: `categories`, `products`, `product_images`, `media_uploads`, `offers`, `customers`, `orders`, `order_items`, `order_status_events`, `stripe_events`, `leads`, `blog_posts`, `payment_links`, `store_settings`, `admin_users`, `admin_sessions`, `customer_sessions`, `otp_codes`, `rate_limits`.

- No row-level security: access control is `authorize()` in application code plus a least-privilege MySQL user (DML only).
- Orders are created by `placeOrder` in one transaction (product rows locked `FOR UPDATE`, stock decremented, idempotency key). Status changes go through `lib/orders/transitions.ts` and are audited.
- Images live in R2; the DB stores the key, URL, dimensions, size and checksum.
- Schema changes: edit `schema.ts`, `npm run db:generate`, review the SQL, `npm run db:migrate`.

## 6. Workflows

### Customer order (guest-friendly)
```
Browse shop/PDP -> add to cart (localStorage) -> /checkout form (Zod, rate-limited)
  -> createOrder server action: reads price/VAT/deposit from DB (never trusts the browser)
  -> placeOrder: one transaction writes orders + order_items + audit row (status: pending, payment: unpaid)
     |-- COD:  redirect to /order-confirmation/[public_token]; staff mark cash received later
     |-- Card: create Stripe Checkout Session (items + "VAT 5%" line) -> redirect to Stripe
                -> Stripe webhook: verify signature, dedupe event, match session/amount/currency -> payment paid + confirmed
                -> buyer lands on confirmation page -> cart cleared
```

### Lead / corporate enquiry
Visitor submits form -> `createLead` -> `leads` row -> admin sees it in the CRM Kanban and moves it through stages.

### Admin payment link
Admin creates a link -> Stripe Payment Link via API (or pastes a URL manually if Stripe isn't configured) -> sent to customer (WhatsApp) -> webhook marks the order paid.

### Content management
Admin edits product/category/offer/post -> saved through the authorized server action -> storefront updates on the next ISR revalidation (up to 5 min).

### Auth
- Customers: email code -> `/account`.
- Admins: email + password (+ TOTP) at `/admin/login`; the gate requires a DB session whose MFA step has passed.

## 7. Security rules

- Money is always computed server-side; the client sends only `productId` + `qty`.
- All public input is validated with Zod and rate-limited with `withinRateLimit()`.
- Order confirmation is looked up by random `public_token`, never by order number.
- `lib/db`, `lib/auth/*` and the R2 modules are server-only and never imported into Client Components.
- Visitors get generic errors; details go to `console.error`.
- Secrets live in env vars only (`.env.example`). `NEXT_PUBLIC_*` are build-time; DB, R2, Brevo and Stripe secrets are runtime only (`/etc/adhira/env` on the VPS).

## 8. Running locally

```bash
docker run -d --name adhira-mysql -p 127.0.0.1:3307:3306 -e MYSQL_ROOT_PASSWORD=... -e MYSQL_DATABASE=adhira \
  -e MYSQL_USER=adhira_app -e MYSQL_PASSWORD=... mysql:8.4 --default-time-zone=+00:00
# optional: MinIO as an R2 stand-in (set R2_ENDPOINT, MEDIA_PUBLIC_URL in .env.local)
cp .env.example .env.local        # fill DATABASE_URL, DATABASE_MIGRATE_URL, AUTH_SECRET
npm install && npm run db:migrate
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... npm run admin:create
npm run dev                       # http://localhost:3000  (sign-in codes print to the server log without Brevo)
```

Deploy: see `docs/DEPLOYMENT.md` (Nginx + systemd on the VPS).

## 9. Known boundaries

- No product variants table: the PDP has no price-varying size selector.
- Stock tracking is optional per product (`stock_qty`); there is no low-stock panel.
- Tabby/Tamara are scaffolded only (see `src/lib/bnpl/README.md`), pending merchant approval.
- Stripe runs without keys in dev and degrades gracefully.
- No `npm test` suite; see the `verify:*` scripts and `docs/LAUNCH_CHECKLIST.md`.

# Flowers N Plants — App Overview

B2B florist and plant storefront with an admin panel, for offices in Dubai, Abu Dhabi and Sharjah (UAE). All product content (products, prices, images, details) is managed by admins in the database. Nothing is hardcoded.

## 1. Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 (CSS-based `@theme`, no `tailwind.config.js`) |
| Fonts | Geist, Geist Mono, IBM Plex Sans Arabic (Arabic only) |
| Database / Auth / Storage | Supabase (Postgres, Auth, Storage), RLS on every table |
| i18n | next-intl, `en` / `ar`, path-prefixed (`/en/...`, `/ar/...`), full RTL |
| Payments | Stripe (Checkout, Payment Links, webhooks); COD live; Tabby/Tamara scaffolded |
| Validation / security | Zod, Postgres-backed rate limiting, CSP headers in `next.config.ts` |
| Deploy | Hostinger VPS (Docker + Caddy); DB/auth/storage on Supabase cloud (see `docs/DEPLOYMENT.md`) |

Next.js 16 notes: `middleware.ts` is now `src/proxy.ts`. Read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).

## 2. Architecture

```
Browser
  |
  v
src/proxy.ts  -- next-intl locale routing + Supabase session refresh (/admin, /account)
  |
  +--> src/app/[locale]/...   Storefront (en/ar, RTL)  --reads-->  src/lib/data/*  --> Supabase (anon, RLS)
  +--> src/app/admin/...      Admin panel (English only)  --writes--> server actions (authorize() first)
  +--> src/app/auth/callback  Magic-link/OTP code exchange (not locale-prefixed)
  +--> src/app/api/stripe/webhook   Stripe events --> flips orders to paid
  +--> src/app/sitemap.ts, robots.ts
```

Supabase clients (`src/lib/supabase/`):
- `client.ts`: browser, anon key.
- `server.ts`: cookie-based session, RLS applies.
- `public.ts`: anon, no cookies; lets pages be static/ISR.
- `admin.ts`: service role, server-only, bypasses RLS (orders, webhooks, staff).

## 3. Storefront (`src/app/[locale]/`)

Routes: `/` home, `/shop`, `/shop/[category]`, `/products/[slug]`, `/cart`, `/checkout`, `/order-confirmation/[token]`, `/setups`, `/corporate`, `/offers`, `/blog`, `/blog/[slug]`, `/account`, `/account/sign-in`.

- **Cart**: client-only (`localStorage`), no cart table. It only becomes data when placed as an order. It is cleared on the confirmation page so a cancelled Stripe checkout keeps the cart.
- **Pricing**: all math goes through `priceLine()` / `getEffectivePrice()` in `src/lib/pricing.ts`. Rules cover min quantity, min order value, glass vessel + refundable deposit, and monthly rental + deposit. VAT is 5%, and deposits sit outside the VAT base.
- **Leads**: enquiry forms call the `createLead` action (Zod-validated, rate-limited).
- **Account**: Supabase Auth email OTP / magic link (no passwords). A `customers` row is created on first sign-in.
- **SEO**: JSON-LD (Organization, LocalBusiness, Product/Offer, BreadcrumbList, FAQPage), canonical + hreflang, sitemap/robots, ISR (`revalidate = 300`) via `setRequestLocale`.
- **Localization**: UI strings in `messages/en.json` and `ar.json`. Product/category Arabic text is in `*_ar` columns with English fallback (`lib/data/localize.ts`). Enum values (emirates, frequencies) are stored in English and translated only for display.
- **Design**: warm palette, gold accent, serif headings, Geist Mono labels. Use logical Tailwind properties (`start-*`/`end-*`/`ms-*`) for RTL.

## 4. Admin (`src/app/admin/`)

English only, with its own root layout. The auth gate is in `(dashboard)/layout.tsx`, and `/admin/login` sits outside it.

Sections: Dashboard (hand-rolled SVG charts), Products (form with live `ProductCard` preview and image upload), Categories, Orders, Offers, Payment Links, CRM (leads Kanban), Blog CMS, Customers, Reports (CSV export), Settings (store settings, staff & roles).

Roles (`src/lib/admin/roles.ts`, mirrored by RLS `has_admin_role()`):
- **owner**: everything, including staff and payment links.
- **manager**: catalog, offers, blog, reports.
- **staff**: orders, leads, customers.

Every admin server action must start with `authorize(...)`. Route handlers must re-check `getCurrentAdmin()` themselves.

Local admin: `scripts/create-local-admin.sh` creates `admin@flowersandgifts.ae` / `AdminDev123!`.

## 5. Data layer (`supabase/`)

Tables: `categories`, `products`, `product_images`, `offers`, `customers`, `orders`, `order_items`, `leads`, `blog_posts`, `payment_links`, `admin_users`, `store_settings`, plus rate-limit storage.

- Public can read active/published content. Admins can read and write per role. `leads` allows insert only.
- `orders`, `order_items` and `payment_links` have no public write policy. They are written through the service role.
- Orders are created atomically by the `create_order_tx` Postgres function.
- Storage: public-read `product-images` bucket with admin-only write.
- Migrations are the only way to change the schema. After changing one, regenerate types: `supabase gen types typescript --local 2>/dev/null > src/lib/supabase/types.generated.ts`.
- `supabase/seed.sql` holds sample categories, products, offers and posts.

## 6. Workflows

### Customer order (guest-friendly)
```
Browse shop/PDP -> add to cart (localStorage) -> /checkout form (Zod, rate-limited)
  -> createOrder server action: reads price/VAT/deposit from DB (never trusts the browser)
  -> create_order_tx writes orders + order_items (status: pending)
     |-- COD:  redirect to /order-confirmation/[public_token]
     |-- Card: create Stripe Checkout Session (items + "VAT 5%" line) -> redirect to Stripe
                -> Stripe webhook verifies signature -> sets order paid (only if still pending)
                -> buyer lands on confirmation page -> cart cleared
```

### Lead / corporate enquiry
Visitor submits form -> `createLead` -> `leads` row -> admin sees it in the CRM Kanban and moves it through stages.

### Admin payment link
Admin creates a link -> Stripe Payment Link via API (or pastes a URL manually if Stripe isn't configured) -> sent to customer (WhatsApp) -> webhook marks the order paid.

### Content management
Admin edits product/category/offer/post -> saved through the authorized server action -> storefront updates on the next ISR revalidation (up to 5 min).

### Auth
- Customers: email OTP -> `/auth/callback` -> `/account`.
- Admins: email + password at `/admin/login`; the gate checks the `admin_users` row.

## 7. Security rules

- Money is always computed server-side; the client sends only `productId` + `qty`.
- All public input is validated with Zod and rate-limited with `withinRateLimit()`.
- Order confirmation is looked up by random `public_token`, never by order number.
- The service-role client is never imported into Client Components.
- Visitors get generic errors; details go to `console.error`.
- Secrets live in env vars only (`.env.example`). `NEXT_PUBLIC_*` are build args; the service-role and Stripe keys are runtime only.

## 8. Running locally

```bash
colima start            # or Docker Desktop
supabase start          # local Postgres/Auth/Storage, applies migrations + seed
./scripts/create-local-admin.sh
npm install && npm run dev      # http://localhost:3000
```

Deploy: run `supabase db push` before deploying new code (see `docs/DEPLOYMENT.md`).

## 9. Known boundaries

- No product variants table: the PDP has no price-varying size selector.
- No inventory or stock column, so there is no low-stock panel.
- Tabby/Tamara are scaffolded only (see `src/lib/bnpl/README.md`), pending merchant approval.
- Stripe runs without keys in dev and degrades gracefully.
- No automated test suite is wired into `npm test`.

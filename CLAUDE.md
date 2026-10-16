@AGENTS.md

# Adhira flowers — Corporate E-commerce (UAE) · adhiraflowers.ae

B2B florist/plant storefront + admin panel for offices in Dubai, Abu Dhabi and Sharjah. Storefront content (products, prices, images, details) is fully admin-managed — no hardcoded product content. The brand name lives in one place: `SITE_NAME` in `src/lib/seo/site.ts`.

Source of truth for architecture and operations: `Adhira_Flowers_Architecture_Setup_Plan.pdf` (summarised in `docs/DEPLOYMENT.md`, `docs/LAUNCH_CHECKLIST.md`, `docs/MIGRATION.md`).

## Stack

- **Next.js 16 (App Router) + TypeScript strict**, Tailwind CSS v4 (CSS-based `@theme`, no `tailwind.config.js`)
- **MySQL 8.4** on the VPS, bound to `127.0.0.1`, via **Drizzle ORM** (`mysql2`); migrations in `drizzle/`
- **Self-hosted auth**: admins = email + password (Argon2id) + TOTP MFA; customers = email OTP. No Supabase anywhere.
- **Cloudflare R2** for images (presigned PUT uploads, server-side re-encode with `sharp`), served from `MEDIA_PUBLIC_URL`
- **Brevo** transactional API for sign-in codes, order and alert emails
- **next-intl**: `en` / `ar`, full RTL, path-prefixed locales
- **Stripe**: Checkout, Payment Links, webhooks; card payment is the only live method (no Cash on Delivery); Tabby/Tamara scaffolded only
- **Deploy**: Hostinger Ubuntu VPS — Nginx + systemd (no Docker/PM2/Caddy). Release dirs + symlink. See `docs/DEPLOYMENT.md`.
- Next.js 16 renamed `middleware.ts` → **`proxy.ts`** (`src/proxy.ts`). It now only does next-intl locale routing (and skips `/admin`).

## Layout

- `src/app/[locale]/...` — storefront; `[locale]/layout.tsx` is the root layout (`<html>`, fonts, intl provider). No `src/app/layout.tsx` by design.
- `src/app/admin/...` — English-only admin with its own root layout; `(dashboard)/layout.tsx` is the auth gate, `login/` sits outside it. Route handlers are not covered by layouts: always call `authorize()` in them (see `reports/export/route.ts`).
- `src/app/api/{health,search,stripe/webhook}` — route handlers. `src/app/{sitemap,robots}.ts` are global.
- `src/i18n/navigation.ts` — locale-aware `Link`/`useRouter`/`redirect`; use instead of `next/link` / `next/navigation` in storefront code.
- `src/lib/db/{index,schema,helpers}.ts` — pool + Drizzle, tables, `newId()`/`isDuplicateKey()`/`dbErrorMessage()`.
- `src/lib/auth/` — `crypto` (hash/HMAC/AES-GCM), `password` (Argon2id), `totp`, `admin-session`, `customer-session`, `cookies`, `origin` (`assertSameOrigin`).
- `src/lib/orders/` — `place-order.ts` (the transaction), `transitions.ts` (state machine, payment, deposit; audit log).
- `src/lib/media/` — `config`, `r2`, `process` (sharp pipeline), `store`, `upload-client` (browser helper), `allowed-url`.
- `src/lib/data/*` — storefront reads (Server Components, cached with `unstable_cache` + `CATALOG_TAG`); `data/admin/*` — admin reads. Row shapes are snake_case and timestamps are ISO strings (custom `ts` column type) so UI code is independent of the DB.
- `src/lib/actions/*` — server actions; `actions/admin/*` must start with `authorize(...)`.
- `src/lib/{pricing,constants,validators,seo,notify,security,stripe,bnpl,cart}` — as named. `deploy/` — server config + scripts. `scripts/` — CLI tools.

## Database (`drizzle/`, `src/lib/db/schema.ts`)

- Change the schema in `schema.ts`, then `npm run db:generate`; hand-written SQL (triggers, CHECKs, generated columns) goes in a `--custom` migration. Apply with `npm run db:migrate` using `DATABASE_MIGRATE_URL` (schema owner). The app connects as `DATABASE_URL` (`adhira_app`, DML only). Never run manual SQL against production; never run destructive actions without a fresh backup.
- IDs are `CHAR(36)` UUIDs generated in the app. Timestamps are `DATETIME(3)` UTC. Money is `DECIMAL(10,2)` surfaced as JS numbers; all arithmetic goes through integer fils in `priceLine()`.
- The email unique indexes rely on the case-insensitive collation `utf8mb4_0900_ai_ci`. `tags`/`details`/`address` are JSON columns. "One primary image per product" is a unique index on a generated column. The last owner can't be removed/demoted (triggers).
- InnoDB `REPEATABLE READ` gotcha: after a duplicate-key error inside a transaction, re-read with a locking read (`.for("share")`), otherwise you still see the old snapshot (see `upsertCustomer`).
- Local dev: `docker run` a `mysql:8.4` (utf8mb4, `--default-time-zone=+00:00`) and MinIO as an R2 stand-in; see `.env.example`. `npm run db:migrate`, `npm run admin:create`. Data from the old Supabase build: `npm run db:import-supabase`, `npm run media:migrate`.

## Security rules (do not regress)

- **Never trust the browser for money.** `createOrder` takes only `productId` + `qty` (+ vessel/months); price, discount, VAT, deposit and totals are computed from DB rows locked `FOR UPDATE` inside `placeOrder`. All pricing uses `priceLine()` in `src/lib/pricing.ts`.
- **Every admin server action and mutating route handler starts with `authorize(permission)`** (also does the Origin check). There is no RLS: `authorize()` + the least-privilege MySQL user are the access control. Roles in `src/lib/admin/roles.ts`: `owner` (all, staff, settings, payment links), `manager` (+ catalog, offers, blog, reports), `staff` (orders, leads, customers). A session counts only after password **and** MFA (if enrolled).
- Public actions: validate with Zod (`src/lib/validators/*`), call `assertSameOrigin()`, rate-limit with `withinRateLimit()` / `hitRateLimit()` (MySQL-backed). Return generic errors, `console.error` the detail.
- Sessions: random token in an HttpOnly cookie (`SameSite=Strict` admin, `Lax` customer, `__Host-` prefix in production); only the SHA-256 is stored. New token on login and MFA. OTP codes are HMAC-hashed, expire in 10 min, 5 attempts, rate-limited.
- **Order confirmation is looked up by `orders.public_token`** (random UUID), never the order number.
- **Orders are written only through `placeOrder`; status/payment/deposit only through `src/lib/orders/transitions.ts`** (state machine in `lib/constants/order.ts`, every change in `order_status_events`). There is no Cash on Delivery. Payment is set to paid only by the verified Stripe webhook, or by the **owner-only** `markPaidManually` action (reference required, `payment_method` becomes `manual`, audited, customer emailed) for transfers / mismatches. A checkout that never gets paid is cancelled (and restocked) by the `checkout.session.expired` webhook, or immediately if the Stripe session can't be created. `orders.payment_method` still allows legacy `cod` values for history only.
- **Stripe webhook** (`api/stripe/webhook`): verify signature on the raw body, claim the event id in `stripe_events` (dedupe), require `session.id` == the order's stored session, `amount_total` == order total in fils and currency `aed`. Don't drop the VAT / deposit line items in `createOrder`'s Checkout session.
- **Uploads**: admin asks for an intent (`requestUploadIntent`), PUTs to a presigned single-object URL under a random `staging/` key, then `finalizeUpload` reads the bytes back, rejects anything that isn't a real JPEG/PNG/WebP (SVG rejected), caps size/pixels, strips EXIF, re-encodes to WebP + derivatives, publishes under a random key, deletes the staging object. Product/category/settings validators accept only `MEDIA_PUBLIC_URL` (and Unsplash seed) image URLs.
- Secrets only in env (`.env.example` lists names). `NEXT_PUBLIC_*` are build-time. Never import `lib/db`, `lib/auth/*`, `lib/media/{r2,process,store}` into a Client Component (they're `server-only`).
- Security headers/CSP are in `next.config.ts` (img-src/connect-src include the media + R2 origins from env) and repeated in Nginx.
- Store-wide values (WhatsApp, contacts, TRN, hero image) live in `store_settings` (single row, id 1), edited in Admin > Settings. Product/category Arabic text is in `*_ar` columns with English fallback (`lib/data/localize.ts`).

## Design tokens (`src/app/globals.css`)

CSS variables + Tailwind v4 `@theme inline`; use arbitrary-value var syntax, e.g. `bg-(--color-primary)`. Fonts: Geist, Geist Mono (`.font-mono-label`), IBM Plex Sans Arabic (`ar`). `--color-muted` was darkened for WCAG AA; re-check contrast before changing.

## Conventions

- Server Components by default; Client Components only for interactivity. Small typed components.
- **Forms** that call actions resolving to `{ ok: false }` must use `onSubmit` + `preventDefault` + `new FormData(e.currentTarget)`, not `<form action={fn}>` (React 19 resets uncontrolled fields when the action settles). Fully controlled admin forms are unaffected.
- **Cart** is client-only (`localStorage`); it hydrates in `useEffect` with a `useState` flag (not a ref) — read the comment in `cart-context.tsx` before changing it. It is cleared on the confirmation page, not at submit (so a cancelled Stripe checkout keeps it). Checkout sends a per-attempt `idempotencyKey`; a repeat submit returns the same order.
- **Localization**: UI text in `messages/{en,ar}.json`, namespaced by page; `getTranslations` in async Server Components, `useTranslations` elsewhere. `/admin` is not localized. Enum values (emirates, frequencies) are stored in English and translated for display (`lib/constants/emirates.ts`). `ProductCard` takes `navigable` and `addToCartLabel` props so the admin preview can render it without intl context — pass them at new call sites.
- **RTL**: use logical Tailwind properties (`start-*`/`end-*`/`ms-*`/`me-*`); grep for `left-|right-|ml-|mr-|pl-|pr-` before adding positioned elements.
- **SEO/perf**: call `setRequestLocale(locale)` at the top of layouts, `generateMetadata` and static pages; pages backed by admin-editable data use `revalidate = 300` and the `catalog` cache tag (`refreshStorefront()` after admin writes). `images.qualities` in `next.config.ts` is an allowlist — add a value there before using it. Product cards render `<h3>`; put an `sr-only <h2>` between an `<h1>` and a card grid.
- Heading/JSON-LD/canonical/hreflang helpers live in `src/lib/seo` and `src/components/seo`.

## Verification scripts

`npm run verify:orders` (oversell race, idempotency, state machine, audit — needs local MySQL), `npm run verify:webhook` (signed Stripe events against a running dev server), `npm run lint`, `npx tsc --noEmit`, `npm run build`. Browser flows were verified with a throwaway Playwright install (not a project dependency). There is no `npm test` suite yet.

## Known boundaries

- No product-variant pricing table (PDP "size" rows are display-only); stock is optional per product (`products.stock_qty`, NULL = untracked; set a number to enforce it) and there is no low-stock panel; no bilingual blog/product-body columns beyond `*_ar` fields; Tabby/Tamara are scaffolds (`src/lib/bnpl/README.md`); Recurring/Quotes on the account page are placeholders.
- Restocking on cancel adds back the order quantity even if stock tracking was switched on after the order was placed.
- `npm run build` prerenders pages from MySQL, so the build machine needs `DATABASE_URL` reachable (on the VPS that is localhost).
- `AUTH_SECRET` encrypts TOTP secrets; changing it forces MFA re-enrolment.

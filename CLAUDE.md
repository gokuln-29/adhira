@AGENTS.md

# Adhira Flowers — Corporate E-commerce (UAE) · adhiraflowers.ae

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
- `src/lib/invoices/` — `number.ts` (AF/2026-27/001, FY 1 Apr–31 Mar Dubai time), `issue.ts` (called inside `markOrderPaid`'s transaction), `data.ts`, `pdf.ts` (headless Chrome via `CHROME_PATH`). Pages: `src/app/invoice/[token]` (own root layout, bilingual) and `…/pdf`.
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
- **Admin password reset** (`actions/admin/password-reset.ts`, pages `/admin/forgot-password`, `/admin/reset-password`): emailed link, SHA-256 stored, single-use, 30-minute expiry, newest link wins, generic response for unknown emails, rate-limited (IP, email, per-link guess cap); accounts with 2FA must also give an authenticator/recovery code (`lib/auth/mfa.ts`, replay-protected); completing it signs out every session and emails a notice. Owners can send a link to a colleague from Settings.
- **Timestamps**: `toMysqlDatetime` is idempotent (a MySQL-format string is already UTC and passes through). Never re-wrap values for comparisons in a way that makes `new Date("YYYY-MM-DD HH:mm:ss")` parse as local time; `npm run verify:time` guards this in four timezones.
- **Order confirmation is looked up by `orders.public_token`** (random UUID), never the order number.
- **Orders are written only through `placeOrder`; status/payment/deposit only through `src/lib/orders/transitions.ts`** (state machine in `lib/constants/order.ts`, every change in `order_status_events`). There is no Cash on Delivery. Payment is set to paid only by the verified Stripe webhook, or by the **owner-only** `markPaidManually` action (reference required, `payment_method` becomes `manual`, audited, customer emailed) for transfers / mismatches. A checkout that never gets paid is cancelled (and restocked) by the `checkout.session.expired` webhook, or immediately if the Stripe session can't be created. `orders.payment_method` still allows legacy `cod` values for history only.
- **Stripe webhook** (`api/stripe/webhook`): verify signature on the raw body, claim the event id in `stripe_events` (dedupe), require `session.id` == the order's stored session, `amount_total` == order total in fils and currency `aed`. Don't drop the VAT / deposit line items in `createOrder`'s Checkout session.
- **Alerts** (`lib/ops/alerts.ts`, table `ops_alerts`): `raiseAlert({kind, ref, ...})` for anything that needs a human — payment mismatch, payment on a closed order, webhook handler failure (auto-resolves when Stripe's retry succeeds), burst of invalid webhook signatures, Stripe session creation failing. Deduped per (kind, ref): repeats bump a counter, one email to `ALERT_EMAIL` (falls back to `ORDER_NOTIFY_EMAIL` / the contact email), shown on the admin dashboard to owners/managers until resolved; re-raising a resolved alert reopens it. It never throws. Add new kinds to `AlertKind`.
- **Uploads**: admin asks for an intent (`requestUploadIntent`), PUTs to a presigned single-object URL under a random `staging/` key, then `finalizeUpload` reads the bytes back, rejects anything that isn't a real JPEG/PNG/WebP (SVG rejected), caps size/pixels, strips EXIF, re-encodes to WebP + derivatives, publishes under a random key, deletes the staging object. Product/category/settings validators accept only `MEDIA_PUBLIC_URL` (and Unsplash seed) image URLs.
- Secrets only in env (`.env.example` lists names). `NEXT_PUBLIC_*` are build-time. Never import `lib/db`, `lib/auth/*`, `lib/media/{r2,process,store}` into a Client Component (they're `server-only`).
- Security headers/CSP are in `next.config.ts` (img-src/connect-src include the media + R2 origins from env) and repeated in Nginx.
- Store-wide values (WhatsApp, contacts, TRN, hero image) live in `store_settings` (single row, id 1), edited in Admin > Settings. Product/category Arabic text is in `*_ar` columns with English fallback (`lib/data/localize.ts`).

## Structured data (JSON-LD)

- Product pages publish `Product` + `Offer` (`lib/seo/product.ts`), blog posts `BlogPosting` (`lib/seo/blog.ts`), the site `Organization` + `FloristShop` (`lib/seo/organization.ts`), plus `BreadcrumbList` and the Corporate `FAQPage`. **Markup must match the page**: the price is what the page sells it for (rentals publish the *monthly* price with `unitCode: MON`, sale prices the discounted price, `valueAddedTaxIncluded: false` because prices exclude VAT) and `availability` follows tracked stock (page cache can lag it by up to 5 minutes).
- **Never hardcode business identifiers in markup.** `taxID`/`vatID`, phone, email and street address come from Settings and are omitted until entered (a placeholder TRN used to be published site-wide; `verify:structured-data` fails if it ever reappears). The logo is the real 180 px `/apple-icon`.
- `npm run verify:structured-data` (needs the dev server) validates every product page in both locales plus Organization, FAQ and blog markup. Google's Rich Results Test on the live URLs remains the authoritative check.

## Mobile and accessibility

- Audited with axe-core (WCAG 2.0/2.1/2.2 A + AA + best practices) plus overflow and target-size checks on 14 storefront pages × 320 / 390 / 1280 px × en / ar: **0 violations, 0 horizontal overflow**. Rules to keep: every tappable control is >= 24 px (icons get a 44 px hit area via `size-11` with negative margins; inline links inside a sentence are exempt); an element with `aria-label` must contain its visible text (prefer visually-hidden text in the content over `aria-label`); decorative large text still needs 3:1 contrast; scroll-reveal content is measured after the animation, so don't judge contrast mid-fade; content must sit inside a landmark (the announcement bar is a labelled `<section>`); don't skip heading levels (`LeadForm` takes `headingAs`).
- Checkout on phones shows the order summary (and the discount-code box) **first** (`max-lg:order-first`), then the form, so the total is seen before paying.
- Admin is usable on phones: below `lg` the sidebar is a slide-out drawer (menu button top-left), content is full width and tables scroll inside their cards. Keep new admin pages free of fixed widths; check `/admin/*` at 390 px for page-level horizontal scroll.

## Stock

- Optional per product (`products.stock_qty`, NULL = not tracked, always sellable). `placeOrder` locks the product rows and decrements; cancelling an order restocks. **Alert level** = `store_settings.low_stock_threshold` (Admin > Settings > Stock alerts, default 5; at or below is "low", 0 is "out").
- `lib/stock.ts` (client-safe `stockStatus`) and `lib/ops/stock.ts`: `syncStockAlerts(ids?)` raises ONE `low_stock` / `out_of_stock` alert (one email, `ALERT_EMAIL`) per product per episode and resolves it when stock recovers; it is called after an order (`createOrder`, in `after()`), after a cancel-restock, after admin product saves/bulk status changes and after the alert level changes. `getLowStockProducts()` feeds the dashboard **Stock** panel (owners/managers); stock alerts are excluded from the generic "Needs attention" panel to avoid duplicates. The products table has a Stock column.
- Storefront: shop cards get a "Sold out" badge and no hover CTA; the product page shows "Only N left" at or below the alert level, "out of stock" with a disabled button at 0, caps the quantity at what's left, and the JSON-LD says OutOfStock. This is display only (pages are cached; `refreshStockPages()` busts the catalog tag when stock moves); `placeOrder` is the authority and answers "only N left".

## Slug redirects

- Renaming a product, category or blog post keeps its old URL alive: `recordSlugChange` (inside the save transaction in the admin actions) stores `old slug -> item id` in `slug_redirects`; the storefront pages call `notFoundOrRedirect` (`lib/redirects-page.ts`) when a slug matches nothing and answer **308 permanent redirect** to the item's *current* slug (by id, so A→B→C never chains), keeping the locale and, for categories, the query string (?sort, ?page, ?tag). Unknown slugs still 404; drafts/unpublished targets aren't redirected to; a slug an item now uses is never a redirect; deleting an item deletes its redirects. Admin > Redirects (owners/managers) lists them and can remove one. New slug-bearing content types must call `recordSlugChange` / `clearRedirectsFor` in their save/delete actions and use `notFoundOrRedirect` on their page.

## Discount codes (coupons)

- A coupon is an **active offer with a `code`** and type `percent` or `flat` (the old "code-only" type is not redeemable; the admin form flags it). Admin > Offers & Coupons: scope (all / chosen categories / chosen products via `offer_targets`), minimum spend, total uses, uses per customer (by email), first/last day (both inclusive, Dubai dates). One code per order. Codes are matched case-insensitively. Offers without a code are announcements only.
- **Maths** (`lib/offers/coupon.ts`, pure): the discount comes off the *eligible goods before VAT* (vessel fee included; delivery and deposits never discounted), is split across eligible lines with largest-remainder rounding, and **VAT is recomputed on each net line**. `order_items.line_total` and `orders.subtotal` are therefore NET; `order_items.discount` / `orders.discount_total` / `coupon_code` / `offer_id` record what was taken off, and invoices snapshot `discount_total` + `coupon_code`. The total formula is unchanged (`subtotal + vat + deposit + delivery`). A code that would push the total under AED 2 is refused (Stripe minimum).
- **Authority**: `placeOrder` calls `evaluateCoupon(tx, …, {lock:true})`: the offer row is locked FOR UPDATE and usage is counted with locking reads (`FOR SHARE`), so limits hold under concurrent checkouts (5 simultaneous checkouts of a 2-use code → exactly 2 win). A redemption row is written in the same transaction; **cancelled orders don't count**, so a failed card start gives the use back. The checkout "Apply" button calls `quoteCoupon` (`actions/coupons.ts`, rate-limited preview using the same server code) and re-quotes when the cart changes. Stripe has no negative lines, so a discounted line is sent as one net-price line (`lib/stripe/line-items.ts`, tested to sum to `orders.total`).
- Public Offers page only lists redeemable offers inside their window. A coupon stacks with a product's own sale price.

## Delivery rules (fees, cut-off, windows)

- Admin-editable in **Admin > Delivery** (owner only; tables `delivery_zones`, `delivery_settings`, `delivery_blackouts`): per-emirate enabled / fee (before VAT) / free-over threshold / same-day, the same-day cut-off (Dubai time) and minimum prep hours, how far ahead to book, closed weekdays, closed dates, and which of the three windows (morning/afternoon/evening) are on. Defaults: all emirates on, fees **0**, same-day in Dubai/Sharjah/Ajman before 14:00, 2 h prep.
- **One rule engine, two callers**: `src/lib/delivery/rules.ts` is pure; the browser uses it for the preview (banner, product-page estimator, checkout fee/date/slot) and `placeOrder` runs `validateDelivery` against *fresh* DB rules as the authority (`getDeliveryRulesFresh`; the UI copy comes from the cached `getDeliveryRules`, tag `catalog`). Date and slot are required on every order.
- The fee is a taxable supply: `orders.delivery_fee` (before VAT), `orders.delivery_vat`, and `orders.vat` includes it. Stripe gets a "Delivery" line and a VAT line covering goods + delivery (`lib/stripe/line-items.ts`, tested to sum to `orders.total`). Invoices snapshot `delivery_fee`/`delivery_vat` and print delivery as a taxed line.
- Don't hardcode "2 PM" or "in Dubai" in copy: the banner and estimator are generated from the rules; static pages say "selected emirates ... daily cut-off".

## Invoices (UAE tax invoice)

- Issued in the **same transaction as the payment** (`markOrderPaid` → `issueInvoice`), so the number exists iff the payment does and the sequence is gap-free (`invoice_counters` row lock). Format `AF/<FY>/<seq>` with seq padded to 3 digits; the counter restarts each financial year. Change `FY_START_MONTH` in `lib/invoices/number.ts` if the accountant wants calendar years.
- Immutable: DB triggers block UPDATE/DELETE on `invoices`; supplier (legal name, address, TRN, contacts from Admin > Settings) and buyer details are **snapshotted when issued**. Lines come from `order_items` (name, `name_ar`, `vat_rate`, `vat` snapshots). Deposits are shown outside the VAT base.
- Delivery: bearer link `/invoice/<orders.public_token>` (noindex, never the order/invoice number), PDF at `…/pdf`, PDF attached to the customer email when `CHROME_PATH` is set (link otherwise), linked from the confirmation page, account page and admin order page.
- **Set the TRN (and legal name/address) in Admin > Settings before the first real order**: an invoice issued without it says "Supplier TRN not yet registered" and can't be corrected. No credit notes yet (refunds need one).

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

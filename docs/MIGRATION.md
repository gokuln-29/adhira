# Migration map: Supabase → MySQL + R2 + self-hosted auth

Source of truth: `Adhira_Flowers_Architecture_Setup_Plan.pdf`. Branch: `feat/mysql-r2-migration`.

## Decisions (final)

| Concern | Before | After |
|---|---|---|
| Database | Supabase Postgres + RLS | MySQL 8.4 on the VPS, `127.0.0.1` only, utf8mb4, UTC |
| ORM / migrations | SQL files in `supabase/migrations` | **Drizzle ORM** (`mysql2`) + `drizzle-kit` migrations in `drizzle/` |
| Access control | RLS + `has_admin_role()` | `authorize()` in every admin action/route + least-privilege DB user |
| Images | Supabase Storage `product-images` | Cloudflare R2, presigned PUT, server-side re-encode to WebP, media domain |
| Admin auth | Supabase Auth password | Own table, Argon2id, TOTP MFA, rotating DB-backed sessions |
| Customer auth | Supabase email OTP | Own OTP (hashed, expiring, attempt-limited), emailed via Brevo API |
| Email | Resend | Brevo transactional API |
| Rate limiter | `hit_rate_limit()` Postgres fn | Same fixed-window logic on a MySQL `rate_limits` table |
| Order creation | `create_order_tx()` plpgsql | TypeScript transaction, idempotency key, `SELECT … FOR UPDATE` stock locking |
| Hosting | Docker + Caddy | Nginx + PM2 (non-root), release dirs + symlink |
| Backups | Supabase | daily mysqldump → encrypt → offsite (rclone crypt), restore drill |

## Inventory of Supabase usage (58 files)

**Clients** `src/lib/supabase/{admin,client,public,server,types,types.generated}.ts` → replaced by `src/lib/db/` (`index.ts`, `schema.ts`).

**Storefront data layer** `src/lib/data/{products,offers,blog,settings,customers,orders}.ts`, `product-select.ts`, `types.ts`.
Embedded selects (`product_images(...)`, `categories!inner(...)`) become explicit joins; `tags text[]` and `details jsonb` become MySQL `JSON`.

**Admin data layer** `src/lib/data/admin/{blog,categories,customers,dashboard,leads,offers,orders,payment-links,products,staff,today}.ts`.

**Server actions** `src/lib/actions/{orders,leads,customers}.ts`, `src/lib/actions/admin/{blog,categories,leads,offers,orders,payment-links,products,settings,staff}.ts`.

**Auth** `src/lib/admin/auth.ts` (`getCurrentAdmin`, `authorize`, `requirePermission`; keep the API, swap the backing store), `app/admin/login/page.tsx`, `app/auth/callback/route.ts`, `components/account/{sign-in-form,sign-out-button}.tsx`, `components/admin/topbar.tsx`, `src/proxy.ts` (Supabase session refresh removed).

**Storage / browser Supabase client** `components/admin/products/product-form.tsx`, `components/admin/categories/category-form.tsx`, `components/admin/settings/store-settings-form.tsx` (direct-to-bucket uploads → R2 presigned flow), `components/layout/header-search.tsx` (anon query from the browser → server route).

**Route handlers** `app/api/health/route.ts`, `app/api/stripe/webhook/route.ts`, `app/sitemap.ts`.

**Other** `lib/notify/{email,order-emails}.ts` (Resend → Brevo), `lib/security/rate-limit.ts`, `lib/validators/settings.ts`, `next.config.ts` (images + CSP), `scripts/create-local-admin.sh`, `supabase/`, `docs/DEPLOYMENT.md`, `CLAUDE.md`.

## Schema translation notes

- `uuid` PKs → `CHAR(36)` generated app-side (`crypto.randomUUID()`); keeps existing IDs on import.
- `numeric(10,2)` money → `DECIMAL(10,2)` (matches existing code that reads `Number(...)`); currency column retained. Pricing is already computed in integer fils by `priceLine()`.
- `timestamptz` → `DATETIME(3)` in UTC (`mysql2` configured `timezone: "Z"`).
- `text[]` tags → `JSON`. `jsonb` → `JSON`.
- Partial unique index (one primary image per product) → generated column `primary_key = IF(is_primary, product_id, NULL)` with a UNIQUE index.
- `lower(email)` unique → `email` column with a case-insensitive collation (`utf8mb4_0900_ai_ci`) and UNIQUE.
- `CHECK` constraints kept (MySQL 8.0.16+ enforces them).
- `updated_at` triggers → `ON UPDATE CURRENT_TIMESTAMP(3)`.
- `admin_users.auth_user_id` → own `admin_users` table with `email`, `password_hash`, `totp_secret`; `customers.auth_user_id` dropped (OTP is keyed by email).
- New tables: `admin_sessions`, `customer_sessions`, `otp_codes`, `order_status_events` (audit), `stripe_events` (dedupe), `idempotency_keys`, `rate_limits`.
- Order statuses move to the PDF state machine: `pending, confirmed, preparing, dispatched, delivered, cancelled, refunded`; payment state is a separate `payment_status` (`unpaid, paid, refunded`) so a payment is only recorded by a verified event (Cash on Delivery was later removed). Old values map: `paid→confirmed+paid`, `processing→preparing`, `out_for_delivery→dispatched`.
- `products` gets `stock_qty` (nullable = untracked) for the oversell-safe checkout.

## Phases and verification

0. Inventory + this map. 1. MySQL schema, data layer, order tx, rate limiter, Supabase→MySQL import script. 2. Auth. 3. R2 images. 4. Orders/payments state machine + Stripe hardening. 5. Deployment + backups. 6. Launch checklist, cleanup of Supabase code/deps, CLAUDE.md.

Each phase ends with `npm run lint`, `npx tsc --noEmit`, and an exercised path against the local MySQL (Docker container `adhira-mysql`, port 3307) before the next begins.

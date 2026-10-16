# Launch checklist (PDF sections 9, 10, 11, 12, 13)

Status key: **verified** = I ran it and have evidence recorded here · **partial** = some of it
verified, the rest noted · **pending** = needs the real VPS / accounts / owner action · **blocked** =
needs a decision or an external approval first. Nothing is "verified" because it was written down.

Evidence below was produced on 2026-10-16 against a **local** stack (MySQL 8.4 in Docker, MinIO
standing in for R2, Next.js dev server and a production build run on `localhost`). Anything that
depends on the real server, DNS, TLS, R2, Brevo or Stripe is pending until run there. Re-run the
commands in the "Evidence" column to reproduce.

Owner / date columns are for you to fill when you re-verify on the VPS.

## 0. Decisions needed from the owner (PDF §1) — **blocked until answered**

| Item | Recommended | Decision |
|---|---|---|
| Legal entity, licensing emirate, service area, support contacts | — | _______ |
| VPS plan / Ubuntu release / region / recovery-console access | ≥ 2 vCPU, 4 GB, Ubuntu 24.04 | _______ |
| Payment methods at launch | Card via Stripe only (Cash on Delivery removed) — **Stripe keys are required to take any order**; Tabby/Tamara need merchant approval | _______ |
| RPO / RTO | 24 h / 8 h | _______ |
| Retention | 14 daily + 8 weekly + 12 monthly | _______ |
| Offsite backup provider | Google Drive (dedicated account + MFA) via rclone, or S3-compatible | _______ |
| Order support hours + incident contact | — | _______ |
| R2 delivery model | public bucket on `media.adhiraflowers.ae`, `staging/` prefix lifecycle-deleted | _______ |

## 9. SEO, speed, accessibility, monitoring

| Item | Status | Evidence / note |
|---|---|---|
| Server-rendered public pages; sitemap.xml + robots.txt | **verified** (local) | `/sitemap.xml` 200 with 94 URLs (en+ar × pages/products/categories/posts); `/robots.txt` disallows `/admin /cart /checkout /account /api`. |
| `noindex` on admin / cart / checkout / account / confirmation | **verified** (local) | `/admin/login` → `X-Robots-Tag: noindex, nofollow` + `no-store`; `/en/checkout` has `<meta name="robots" content="noindex, nofollow">`; confirmation → `Cache-Control: no-store`. |
| Canonical + hreflang present | **partial** | `<link rel="canonical">` emitted per page. It points at `NEXT_PUBLIC_SITE_URL`; locally that is `localhost:3000`, so Lighthouse flagged it when served on :3100. **Re-check on staging with the real URL.** Per-page title/description uniqueness not re-audited this session. |
| Product / Offer / Breadcrumb / Organization JSON-LD | **partial** | PDP emits `Product`, `Offer`, `BreadcrumbList`, `FloristShop`, `Organization`. Not run through Google's Rich Results validator: **pending**. |
| Canonical host + redirects (www→apex, HTTP→HTTPS) | **pending** | Configured in `deploy/nginx/adhiraflowers.ae.conf`; syntax verified with `nginx -t` in the official nginx image (self-signed cert). Behaviour needs the real domain. |
| Search Console / analytics connected | **pending** | Owner action. |
| Redirects for changed slugs; useful 404 | **verified** (local) | Renaming a product / category / post keeps the old URL working with a 308: `npm run verify:redirects` (9 checks: A→B→C lands on the latest, rename-back has no loop, a reused slug wins, drafts aren't redirected to, deleting clears them, hostile slugs) plus browser runs (EN/AR paths, `?sort&page` kept on categories, Admin > Redirects list/remove, staff blocked). A custom 404 page exists. Not covered: redirects from a *previous website's* URLs (add manually if you have an old site with indexed pages). |
| Responsive images, WebP, dimensions, lazy load, priority hero | **partial** | Uploads are re-encoded to WebP at ≤2000 px with 480/960/1600 derivatives; `next/image` serves sized variants. Lighthouse perf 100 / LCP 33–450 ms on the production build **but local images were blocked (see note A), so this is not a faithful render**. Re-measure on staging. |
| Cache headers: immutable assets; no public cache of cart/checkout/admin/account | **partial** | Nginx sets immutable on `/_next/static/`; app sends `no-store` on admin + confirmation (verified). `/en/cart`, `/en/checkout` cache headers not individually inspected. |
| DB indexes for slug/category/order lookup/admin filters; pagination | **verified** (schema) | Unique/secondary indexes in `drizzle/0000_init.sql` (slug, status, category, number, public_token, delivery_date, created_at, …); orders list paginated (25). Slow queries not profiled under load. |
| Load test at realistic peak | **pending** | Needs the VPS. |
| Keyboard, labels, focus, alt text, contrast | **partial** | Lighthouse accessibility 96 locally. Fixed footer + "view all" tap targets this session (< 24 px). Remaining: re-run on staging; manual screen-reader pass **pending**. |
| Status not conveyed by colour alone | **pending** | Admin statuses use text labels; storefront not audited. |
| Arabic / RTL | **verified** (local) | All 18 storefront routes × 2 locales return 200; `dir="rtl"` on every `/ar` page; Arabic text present on every sampled page (10–14k Arabic characters each); no raw message keys leaked; new sign-in code strings translated. |
| Payment/webhook alerts (mismatch, payment on a cancelled order, handler failure, invalid-signature burst, Stripe session creation failing) | **verified** (local), real email pending | `npm run verify:webhook` (19 checks, mock Brevo): one alert + one email per problem, repeats only count, handler failure returns 500 and rolls the payment back, Stripe's retry succeeds and clears the alert, 3 simultaneous raisers → 1 email, resolved alerts reopen; dashboard panel + Resolve verified in the browser (owner sees, staff don't). Set `ALERT_EMAIL`; a failed/never-configured Brevo means the dashboard is the only signal. |
| Monitoring: uptime, host resources, app errors, MySQL, R2, backups, payments | **partial** | `deploy/monitoring/check.sh` verified in an Ubuntu 24.04 container: backup-age alert fires at 30 h and clears with a fresh backup; health/disk/memory/MySQL-exposure/TLS checks run. External uptime monitor, R2 error alerts, webhook-failure alerting: **pending / not built** (Stripe/webhook problems now raise alerts: see next row). |

Note A — local-only Lighthouse artefact: the production build refuses to optimise images from a
loopback address (`127.0.0.1:9100` MinIO) → `/_next/image` 400s and "errors in console". Real R2 on
a public hostname is unaffected. Also the CSP adds `upgrade-insecure-requests`, so plain-http MinIO
would be rewritten to https in a real browser.

## 10. UAE business and customer-facing checklist — **all owner/advisor items; nothing verified by code**

This is an operational list, not legal or tax advice; confirm with a UAE-qualified adviser.

| Item | Status | Note |
|---|---|---|
| Licence covers e-commerce + flowers/gifts/events | **pending** | Owner. |
| Trader identity, licence, contact, delivery coverage published | **partial** | TRN, WhatsApp, phone, email are admin-editable (Settings) and shown when set; contact/about/delivery pages exist. Content accuracy: owner. |
| Prices in AED, VAT shown, delivery fees/areas/cut-offs/substitution/refund terms | **partial** | AED + 5 % VAT shown; delivery fee is currently fixed at 0 in `createOrder`; the delivery slot is one of three fixed windows. Policy pages exist; wording needs review. |
| Delivery fees, same-day cut-off, time windows, closed days | **verified** (local), **values pending from you** | `npm run verify:delivery` (10 checks): cut-off exact at 13:59/14:00 Dubai time, prep-time window shrinking, closed weekdays + blackout dates skipped, free-over threshold inclusive, 5% VAT on the fee (15.50 → 0.78), order/invoice/Stripe totals agree, server refuses disabled emirate / after cut-off / closed day / blackout / slot too soon. Browser: checkout shows fee per emirate, pre-fills the earliest date, blocks disabled emirates; Admin > Delivery saves and is owner-only; Arabic/RTL renders. **You must set the real fees** (they default to AED 0 = free), the same-day cut-off, closed dates (Eid, holidays) and which emirates you serve in Admin > Delivery before launch. |
| Dated digital tax invoices (Arabic + English; trade name, address, TRN, goods, price, qty, VAT) | **verified** (local), **blocked on the TRN** | Numbering `AF/2026-27/001` (FY 1 Apr–31 Mar, Dubai time) is gap-free under 12 concurrent payments and doesn't burn numbers on rollback; DB blocks edits/deletes; per-line VAT sums to invoice VAT; bilingual A4 page + PDF rendered and inspected; PDF attached to the customer email (checked against a mock Brevo API). **Needs from you:** TRN (due in ~1 week), legal name + address in English and Arabic (Admin > Settings), Arabic product names (otherwise lines show English only), accountant sign-off on the layout and on the 1 April FY start. **Not built:** credit notes for refunds. Real Chrome install on the VPS and a real Brevo send: pending. |
| Marketing consent / privacy / direct-marketing | **partial** | Privacy and terms pages exist (processor list updated this session: Stripe, Hostinger, Cloudflare, Brevo). No marketing opt-in is collected. Advisor review pending. |
| Privacy notice, terms, delivery, cancellation/refund, cookies | **pending** | Pages exist; legal review pending. No cookie banner (no analytics yet). |
| Tax registration / record-keeping | **pending** | Accountant. |
| Promos / discount codes | **verified** (local) | `npm run verify:coupons` (18 checks) + browser runs: percent/flat, category/product scope, minimum spend, inclusive first/last day, switched-off/unknown/expired codes, near-free orders refused, per-customer and total limits (5 simultaneous checkouts of a 2-use code → exactly 2), cancelled orders return the use; VAT is charged on the discounted amount; order, invoice (shows discount lines) and Stripe items agree to the fils; Arabic messages; admin create/edit/delete with validation. **You must review the live offers:** the seeded `CORP10` says "first order" (I limited it to 1 use per email); `FITOUT150` is expired and no longer shown. Gift cards, corporate quotes: **not built**. |
| Event deposits, restricted goods | **pending** | Deposits supported for vessels/rentals. |
| Vendor/data-location/retention/breach contacts documented | **pending** | Owner. |

## 11. Pre-deployment checklist

### Code and configuration
| Item | Status | Evidence |
|---|---|---|
| Production build from a clean lockfile install | **partial** | `npm run build` succeeds (Next 16.3.3, Node 24 locally); `deploy.sh` uses `npm ci`. Server will run Node 22 (provision.sh) — **build on the VPS pending**. |
| No secrets / `.env` / keys in repo or build | **partial** | `.env*` is git-ignored (only `.env.example` tracked, names only). A history scan for committed secrets was **not** run: do `git log -p \| grep -iE 'sk_live|service_role|AKIA'` before making the repo public. |
| Production env vars documented by name | **verified** | `.env.example`, `docs/DEPLOYMENT.md` §4. |
| Migrations reviewed, repeatable, rollback strategy | **verified** (local) | `drizzle/0000_init.sql`, `0001_constraints.sql` applied to empty MySQL three times (incl. full rebuild tonight). Backward-compatible (expand/contract) policy documented; no down-migrations by design. |
| Errors/logs don't leak stack traces, SQL, tokens, PII | **partial** | Actions return generic messages and `console.error` details (code review). OTP codes are logged only when `NODE_ENV !== production` and email is unconfigured. Not penetration-tested. |

### Security and infrastructure
| Item | Status | Evidence |
|---|---|---|
| DNS, HTTPS redirect, cert renewal | **pending** | `certbot renew --dry-run` on the VPS. |
| Firewall: only 22/80/443; MySQL not internet-reachable; SSH keys; recovery console | **pending** | `provision.sh` written (`bash -n` clean), **not run on a real VPS**. It aborts if MySQL listens publicly; `check.sh` alerts on it. |
| Admin roles, password reset, MFA, rate limits, cookies, CSRF | **verified** (local) | Playwright: wrong password → generic error; password-only session cannot open `/admin`; TOTP enrolment + 8 recovery codes; session token rotates on MFA; wrong/replayed TOTP rejected; recovery codes single-use; cookies `HttpOnly`, admin `SameSite=Strict`, customer `Lax`; staff role bounced from 7 owner/manager pages and `403` on report export; sign-out deletes the DB session. CSRF: Origin check in every action + SameSite + Next's own action check (not separately attacked). Password reset by email: **verified** (local) — see next row. |
| Admin password reset | **verified** (local), real email pending | Playwright (27 checks) against a mock Brevo API: generic response for unknown emails, only a hash of the token stored, single use, 30-minute expiry, newer link kills older, tampered/missing token rejected, weak/mismatched password rejected, all sessions revoked, "password changed" notice sent, old password stops working; accounts with 2FA need a valid authenticator or recovery code (wrong code changes nothing, same code can't be replayed, recovery code is consumed, 8 wrong guesses lock the link); 4th request per email per hour is rate-limited; owner "Send reset link" works. Real Brevo delivery (SPF/DKIM, spam placement): **pending**. |
| R2 bucket/token/CORS/public-access/upload validation | **partial** | Pipeline verified against MinIO: JPEG accepted; SVG-as-.jpg, garbage-as-.png, 100×100 rejected; 3000 px downscaled to 2000; EXIF marker stripped from stored object; derivatives public; staging objects deleted; DB stores key, size, dims, sha-256. Real R2 token scope, CORS and bucket policy: **pending**. |
| OS/app updates, log rotation, disk alerts, restart after reboot | **pending** | unattended-upgrades + systemd `Restart=always` + `WantedBy=multi-user.target` configured, not exercised on a VPS. |

### Commerce
| Item | Status | Evidence |
|---|---|---|
| AED calculations, rounding, delivery fees, discount rules | **partial** | All through `priceLine()` in integer fils; order totals recomputed from locked DB rows. Restore drill checks `total = subtotal + vat + delivery + deposit` on real data. No exhaustive rounding test suite. Delivery fee is 0. |
| Stock race, unavailable product, cancellation, refund flows | **verified** (local) | `npm run verify:orders`: 8 concurrent checkouts of the last unit → exactly 1 order, stock 0; cancel restocks; cancelled order can't reopen; same idempotency key concurrently → 1 order; illegal transitions rejected; 5 audit rows. Substitution and *Stripe refunds* are manual (admin sets `refunded`; money is refunded in the Stripe dashboard). |
| Payment gateway sandbox + webhook replay/duplicate/invalid signature | **partial** | `npm run verify:webhook` against the real route: invalid signature → 400; wrong amount / currency / session id → not paid; unpaid async → ignored; valid → paid + confirmed; duplicate event id → no change; late event doesn't regress status; `session.expired` → cancelled. **Not verified:** a real Stripe test transaction (no keys in this environment), refund webhooks, delayed callbacks beyond the above. |
| Owner records a payment received outside Stripe (bank transfer / webhook mismatch) | **verified** (local) | Playwright: owner sees control, reference required, order → confirmed/paid/`manual`, history shows admin + reference; staff see status but no control. Not covered: reopening a cancelled order that was later paid (blocked by design; handle by a new order). |
| Email/SMS notifications | **partial** | Order/lead/alert/OTP email code on Brevo's API; **never sent to Brevo** here (no key). Dev fallback printed OTP codes. SMS: not implemented. |
| Mobile checkout, address entry, slot, confirmation | **partial** | Desktop Playwright: checkout offers only Card / Apple Pay; with an invalid Stripe key the customer sees an error and the order is cancelled (audit: placed + cancelled). The earlier success path (double-click → 1 order, confirmation by random token, order number alone → 404) was verified with Cash on Delivery before it was removed; the card success path needs a real Stripe test key. Mobile viewport review **pending**. |

### Recovery and launch
| Item | Status | Evidence |
|---|---|---|
| Offsite encrypted backup completed; decrypt + restore verified; retention configured | **partial** | Locally: `backup.sh` → mysqldump → gzip → restic (encrypted repo) → sanity check → forget/prune policy → `restic check` OK; `restore-drill.sh` restored the snapshot into a throwaway DB and verified 20 tables, triggers, admin account, products/images, no orphans, totals; a bad password makes the drill fail loudly, alert, and leave no DB behind. **Real offsite target (Google Drive/rclone), media backup (`rclone copy` R2→crypt remote) and the systemd timers: pending.** Record: drill duration locally 3 s on a tiny dataset — measure on the VPS for the RTO. |
| Rollback release exists; migration rollback steps recorded | **partial** | `deploy.sh` (build → backup → migrate → smoke on :3100 → symlink → health → auto-rollback) and `rollback.sh` written and syntax-checked; **never executed on a real server**. Production standalone build verified locally (`/api/health` ok, headers, all routes 200). |
| Monitoring alert delivery tested from a real external channel | **pending** | Needs Brevo key + `ALERT_EMAIL`. |
| Legal pages reviewed | **pending** | Advisor. |
| Launch owner, emergency contact, window, go/no-go recorded | **pending** | See §13. |

## 12. Post-deployment verification (run on the VPS, from a customer device and the admin)

All **pending**: canonical HTTPS pages · R2 images + derivatives load, no mixed content · admin sign-in,
edit, upload; unauthorised role blocked · contact/enquiry forms reach the intended inbox · full order
journey (single order, totals, stock, email) · Stripe success/decline/abandon/duplicate/invalid-signature/
delayed/refund + reconciliation (if enabled) · no secrets in network responses, logs or source maps ·
sitemap/robots/canonical/schema · mobile layout, keyboard, focus, contrast · monitoring sees the deploy ·
post-launch backup + checksum · record release ID, migration version, evidence, go/no-go owner.

## 13. Phases and status register

| Phase | Outcome / exit gate | Status |
|---|---|---|
| 0. Discovery | Inventory + `docs/MIGRATION.md`; decisions in §0 above | **partial** (code inventory done; business decisions blocked) |
| 1. Foundation | VPS, DNS, firewall, Node, private MySQL, staging | **pending** (scripts + configs written/tested locally) |
| 2. Core store | Catalogue, admin, cart, delivery, order state model | **verified** (local) |
| 3. Media | R2 + secure upload/processing + delivery | **partial** (pipeline verified on MinIO; real R2 pending) |
| 4. Commerce | Order transaction correctness, payments, notifications | **partial** (see §11; invoice not built; no real Stripe/Brevo test) |
| 5. Resilience | Encrypted offsite backup, alerts, retention, restore drill, rollback | **partial** (verified locally; real offsite + timers pending) |
| 6. Quality | Security/a11y/SEO/perf/mobile pass | **partial** (§9/§11) |
| 7. Launch | Pre-deploy gate, release, external smoke tests, go/no-go | **pending** |
| 8. Operations | Daily backup/monitor review, patching, quarterly drill, access review | **pending** |

### Go / no-go
Decision: [ ] GO  [ ] NO-GO  Date/time: ________  Release: ________  Owner: ________

Blockers that must be cleared before GO: §0 decisions; real VPS provisioning + a full run of
`deploy.sh`; real R2, Brevo and (if used) Stripe credentials with an end-to-end test; invoices (§10);
external uptime monitor; offsite backup target + first real restore drill; legal review.

# Deploying Flowers N Plants to a Hostinger VPS

The VPS runs **two containers**: the website (Next.js) and Caddy (automatic HTTPS).
The **database, login and product images live in Supabase (cloud)**. That means no
database to run, patch or back up on the VPS.

```
Visitor ──HTTPS──► Caddy ──► Next.js app ──► Supabase (database, auth, storage)
                                    └────────► Stripe (card payments, optional)
```

You will need: a VPS (Ubuntu 24.04, 2 vCPU / 2 GB RAM minimum; 4 GB is comfortable, the
image build uses memory), a domain name, a Supabase account, and (optional) a Stripe account.

**Order matters. Do the steps in this order.** The database must be ready before the app starts.

---

## 1. Create the Supabase project

1. supabase.com → **New project**. Pick the region closest to your customers (for the UAE,
   choose a Middle East or Mumbai/Singapore region if offered). Save the **database password**.
2. **Project Settings → API**: note the **Project URL**, the **anon key** and the **service_role key**.
   The service_role key is a secret: it bypasses all security. Never put it in the browser,
   in Git or in chat.
3. On your own computer (not the VPS), in the project folder:

   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase db push
   ```

   `db push` creates every table, security rule, the order function and the `product-images`
   storage bucket. Do **not** run `supabase/seed.sql` on production: it contains demo products.

4. **Authentication → URL Configuration**
   - Site URL: `https://YOUR-DOMAIN`
   - Redirect URLs: add `https://YOUR-DOMAIN/auth/callback`
5. **Authentication → SMTP Settings**: enable **custom SMTP** (Resend, Brevo, Amazon SES, or
   your Hostinger mailbox). Supabase's built-in email is limited to a few emails per hour, so
   customer sign-in links would stop working under real traffic.
6. **Create the first owner login.** Authentication → Users → **Add user** → email + a strong
   password (tick *Auto confirm*). Copy the user's UUID, then in **SQL Editor** run:

   ```sql
   insert into admin_users (auth_user_id, name, role)
   values ('PASTE-USER-UUID-HERE', 'Your Name', 'owner');
   ```

7. **Backups**: Database → Backups. Daily backups need the Pro plan. On the free plan, take a
   manual export before every update (section 8).

## 2. Prepare the VPS

Log in as root once, then:

```bash
# Updates + automatic security patches
apt update && apt upgrade -y
apt install -y ufw fail2ban unattended-upgrades git curl

# Firewall: only SSH, HTTP, HTTPS
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Docker
curl -fsSL https://get.docker.com | sh
```

Then create a normal user, add your SSH key to it, and turn off password logins
(`PasswordAuthentication no` and `PermitRootLogin no` in `/etc/ssh/sshd_config`, then
`systemctl restart ssh`). **Test a second SSH session before closing the first.**

## 3. Point the domain at the VPS

At your domain registrar / Hostinger DNS, add:

| Type | Name | Value |
|------|------|-------|
| A | `@` | your VPS IP |
| A | `www` | your VPS IP |

Wait until `ping YOUR-DOMAIN` shows the VPS IP. Caddy cannot get a certificate before this.

## 4. Deploy the app

```bash
git clone https://github.com/gokuln-29/CORP.git flowers && cd flowers
cp .env.production.example .env
nano .env        # fill in every value
docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes several minutes. Then check:

```bash
docker compose -f docker-compose.prod.yml ps        # app should say "healthy"
curl https://YOUR-DOMAIN/api/health                  # {"status":"ok"}
```

Open `https://YOUR-DOMAIN/admin/login` and sign in with the owner account from step 1.6.

## 5. First-time setup in the admin panel

1. **Settings → Store details**: WhatsApp number, phone, email, **company TRN**, hero image.
   (The TRN is hidden on the site until you enter it.)
2. **Categories**, then **Products**. Set minimum order, glass vessel and rental options
   under "Order rules". Add Arabic names if you want them on the Arabic site.
3. **Settings → Staff & Roles**: add staff. Owner = everything. Manager = products, offers,
   blog, reports. Staff = orders, leads, customers only.
4. Place a **Cash on Delivery test order** from the storefront and move it through
   Start processing → Out for delivery → Delivered.

## 6. Card payments (Stripe), optional

Leave the Stripe values empty to accept Cash on Delivery only.

1. Stripe → Developers → API keys: copy the **secret key** into `STRIPE_SECRET_KEY`. Start
   with **test mode** keys.
2. Developers → Webhooks → **Add endpoint**: `https://YOUR-DOMAIN/api/stripe/webhook`,
   event **`checkout.session.completed`**. Copy the **signing secret** into `STRIPE_WEBHOOK_SECRET`.
3. Apply: `docker compose -f docker-compose.prod.yml up -d` (env-only changes don't need `--build`).
4. Pay a test order with card `4242 4242 4242 4242`. The order should change to **PAID** by itself.
5. Only then switch to live keys and a live webhook endpoint.

## 6b. Order emails, optional

With email on, customers get an order confirmation and your team gets a "new order" and
"new enquiry" alert.

1. Create a free account at resend.com and **verify your domain** (add the DNS records it shows).
2. Create an API key and set `RESEND_API_KEY`, `EMAIL_FROM` (an address on your verified
   domain) and optionally `ORDER_NOTIFY_EMAIL` in `.env`.
3. `docker compose -f docker-compose.prod.yml up -d`, then place a test order.

Leave `RESEND_API_KEY` empty to send nothing. Orders still work. A failed email never blocks an order.

## 7. Go-live checklist

- [ ] `https://YOUR-DOMAIN` loads with a valid padlock; `http://` redirects to `https://`
- [ ] `/api/health` returns `ok`
- [ ] Owner can sign in to `/admin`; a Staff test account cannot open Products or Settings
- [ ] A test order works (Cash on Delivery), and the confirmation page opens
- [ ] A customer sign-in email arrives (`/en/account/sign-in`)
- [ ] If email is on: the test order sent a confirmation to the customer and an alert to your team
- [ ] Store details filled in (TRN, WhatsApp) and the WhatsApp button opens the right chat
- [ ] Test data deleted (test orders, test customers)
- [ ] Uptime monitor pointed at `/api/health` (UptimeRobot / BetterStack, free plans work)
- [ ] Anyone who set up the server has changed the default passwords

## 8. Updating the website later

Database changes first, then code:

```bash
# On your computer, if there are new files in supabase/migrations/
supabase db push

# On the VPS
cd flowers
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

**Roll back** a bad release: `git log --oneline`, `git checkout <previous-commit>`, then the
same `up -d --build`. (Database migrations are not automatically undone: take a database
export before applying any migration.)

## 9. Day-to-day

```bash
docker compose -f docker-compose.prod.yml logs -f app     # live logs
docker compose -f docker-compose.prod.yml restart app     # restart
docker compose -f docker-compose.prod.yml ps              # status
```

Logs rotate automatically (10 MB x 5 files each).

## 10. Troubleshooting

| Problem | Likely cause |
|---------|--------------|
| Caddy can't get a certificate | DNS not pointing at the VPS yet, or ports 80/443 blocked |
| App unhealthy right after start | wrong Supabase URL/keys in `.env`; check `logs app` |
| Build fails fetching data | the VPS can't reach Supabase, or `NEXT_PUBLIC_*` values are wrong |
| Changed a `NEXT_PUBLIC_*` value but nothing changed | those are built in: re-run with `--build` |
| Product images don't show | image host isn't `*.supabase.co`; images must be uploaded via the admin |
| Customer sign-in email never arrives | SMTP not configured in Supabase (step 1.5) |
| Card order stays "pending" | Stripe webhook URL or signing secret is wrong (check Stripe → Webhooks → recent deliveries) |
| "Too many orders" shown to a real customer | rate limit: 10 orders / 10 minutes per IP; wait, or many people behind one office IP |

## Security notes

- The **service-role key** and Stripe secret keys exist only in the VPS `.env` file
  (`chmod 600 .env`). They are not in the Docker image or in Git.
- The app container is not reachable from the internet; only Caddy is.
- Customer order pages use random tokens, admin pages are `noindex` and never cached, and
  every admin action checks the user's role on the server.
- Keep the VPS patched (`unattended-upgrades` is enabled above) and review Supabase → Auth →
  Users occasionally for accounts you don't recognise.

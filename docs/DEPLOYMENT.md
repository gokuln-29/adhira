# Deploying Adhira flowers (adhiraflowers.ae) to a Hostinger Ubuntu VPS

Source of truth: `Adhira_Flowers_Architecture_Setup_Plan.pdf`. This document is the
runnable version of PDF sections 2, 5, 6, 7 and 8. Nothing here is marked "done" until
you have run it and recorded the evidence in `docs/LAUNCH_CHECKLIST.md`.

```
Browser ─HTTPS─► Nginx :443 (TLS, headers, rate limits, body limits)
                   └─► 127.0.0.1:3000  Next.js (systemd, user `adhira`, not root)
                          ├─► MySQL 127.0.0.1:3306 (never public)
                          ├─► Cloudflare R2   (images; browser PUTs via presigned URLs)
                          ├─► Stripe          (card payments + signed webhooks, optional)
                          └─► Brevo           (sign-in codes, order emails)
adhira-backup.timer ─► mysqldump ─► gzip ─► restic (encrypted) ─► offsite repo (Google Drive via rclone)
adhira-monitor.timer ─► health / disk / memory / backup age / TLS expiry ─► email alert
```

Repo files used here: `deploy/nginx/*`, `deploy/systemd/*`, `deploy/mysql/*`,
`deploy/scripts/{provision,deploy,rollback}.sh`, `deploy/backup/*`, `deploy/monitoring/*`.

## 0. Decisions to record first (PDF section 1)

Write the answers in `docs/LAUNCH_CHECKLIST.md`: legal entity/emirate, VPS plan (≥ 2 vCPU /
4 GB recommended, the build is memory hungry), Ubuntu release, Hostinger recovery-console access,
payment methods enabled, **RPO** (recommended 24 h), **RTO** (recommended 8 h), retention
(14 daily + 8 weekly + 12 monthly), support hours.

## 1. DNS

`A` (and `AAAA` only if the VPS really has IPv6) for `adhiraflowers.ae` and `www`. If you use
Cloudflare's proxy, set SSL mode to **Full (strict)** and keep the media hostname
(`media.adhiraflowers.ae`) pointed at R2 (step 7), not at the VPS.

## 2. Provision the server (once)

Keep your root SSH session open and **test a second login** before closing it.

```bash
# as root on the VPS, from a checkout of this repo
SSH_ALLOW_FROM=<your.office.ip>  DISABLE_SSH_PASSWORDS=1  sudo -E bash deploy/scripts/provision.sh
```

It installs Nginx, certbot, MySQL, Node 22, restic, rclone, ufw, fail2ban and
unattended-upgrades; sets timezone `Asia/Dubai` (the database stores UTC); creates the
`adhira` service user and `deploy` user; enables the firewall (80/443 + SSH only; **3306 is
never opened**); installs `deploy/mysql/adhira.cnf` (bind `127.0.0.1`) and aborts if MySQL is
listening on a public address. Password SSH is only disabled if an `authorized_keys` exists.

Verify: `sudo ufw status verbose` · `ss -ltn | grep 3306` (only `127.0.0.1`) ·
`sudo unattended-upgrade --dry-run` · from another machine `nc -zv <vps-ip> 3306` must fail.

## 3. Database

```bash
# edit the three CHANGE_ME passwords first (openssl rand -base64 32), then:
sudo mysql < deploy/mysql/create-users.sql
```

Three accounts, all `@localhost`: `adhira_app` (SELECT/INSERT/UPDATE/DELETE only),
`adhira_migrate` (schema owner, used by deploys), `adhira_backup` (read-only dump privileges).
Row-level security no longer exists; access control is `authorize()` in application code plus
this least-privilege account (so even a compromised app cannot `DROP` a table).

## 4. Environment file

Create `/etc/adhira/env` (`root:adhira`, mode `0640`) from `.env.example`. Required in
production: `NEXT_PUBLIC_SITE_URL=https://adhiraflowers.ae`, `DATABASE_URL`,
`DATABASE_MIGRATE_URL`, `AUTH_SECRET` (`openssl rand -hex 32`), `BREVO_API_KEY`, `EMAIL_FROM`,
`R2_*`, `MEDIA_PUBLIC_URL`. Optional: `STRIPE_*`. Secrets exist only here, never in git, the
release directory or the browser. `NEXT_PUBLIC_*` values are compiled in at build time, so
rebuild (deploy again) after changing them. `AUTH_SECRET` must stay stable.

## 5. Systemd and Nginx

```bash
sudo cp deploy/systemd/adhira*.{service,timer} /etc/systemd/system/
sudo cp deploy/nginx/adhira-proxy.conf /etc/nginx/snippets/
sudo cp deploy/nginx/adhiraflowers.ae.conf /etc/nginx/sites-available/ && sudo ln -s ../sites-available/adhiraflowers.ae.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
# First get a certificate (HTTP only config first, or use --standalone while nginx is stopped):
sudo certbot certonly --webroot -w /var/www/certbot -d adhiraflowers.ae -d www.adhiraflowers.ae
sudo nginx -t && sudo systemctl reload nginx
sudo certbot renew --dry-run          # proves auto-renewal works (not just issuance)
sudo systemctl daemon-reload
```

If `nginx -t` fails because the certificate does not exist yet, temporarily comment the two
`443` server blocks, issue the cert, and restore them.

## 6. First deploy

```bash
echo https://github.com/gokuln-29/adhira.git | sudo -u deploy tee /srv/adhira/repo.url   # read-only deploy key recommended
sudo -u deploy bash deploy/scripts/deploy.sh main
sudo systemctl enable --now adhira
curl -s http://127.0.0.1:3000/api/health          # {"status":"ok"}
```

`deploy.sh` (as the non-root `deploy` user): fetch ref → lockfile install → build into a new
`releases/<timestamp>` → fresh DB backup → apply migrations → start the new build on a spare
port and smoke-test `/api/health`, `/en`, `/ar` → flip the `current` symlink → restart →
re-check health → **auto-rollback** to the previous release if the check fails. Keeps the last 5
releases. Rollback by hand: `deploy/scripts/rollback.sh [release-id]`.

Create the first owner (password never goes through argv):

```bash
cd /srv/adhira/releases/$(cat /srv/adhira/current.id)
read -rsp 'Admin password (12+ chars): ' ADMIN_PASSWORD; echo
sudo -u deploy env ADMIN_EMAIL=you@adhiraflowers.ae ADMIN_NAME="Your name" ADMIN_ROLE=owner \
  ADMIN_PASSWORD="$ADMIN_PASSWORD" DATABASE_MIGRATE_URL="<from /etc/adhira/env>" npm run admin:create
unset ADMIN_PASSWORD
```
Then sign in at `/admin/login` and enable two-factor under **Account**; save the recovery codes.

> **Migrations and rollback.** Apply migrations before the new code serves traffic, and write
> them backward compatible (add columns/tables first, switch code, remove old columns in a later
> release). Code rolls back instantly; a database restore discards orders taken since the backup.

## 7. Cloudflare R2 (images)

1. Create bucket `adhira-media`. Attach the custom domain `media.adhiraflowers.ae` (public read).
   Use **separate** `staging/` keys: only the app writes there, and objects are deleted after processing.
2. Create an **API token** scoped to *Object Read & Write* on this bucket only → `R2_ACCESS_KEY_ID/SECRET`.
3. **CORS** on the bucket: allowed origin `https://adhiraflowers.ae` only, methods `PUT`, headers
   `Content-Type`, `Content-Length`. (CORS is not authorization; the presigned URL is.)
4. Lifecycle rule: delete `staging/` objects older than 1 day.
5. Never put personal data in object keys (they are random UUIDs by design).

Existing images from the Supabase build: `npm run media:migrate` (idempotent).

## 8. Stripe (optional) and Brevo

Stripe: webhook endpoint `https://adhiraflowers.ae/api/stripe/webhook`, events
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.expired`; paste the signing secret into `STRIPE_WEBHOOK_SECRET`. Without keys
the site takes Cash on Delivery only. Brevo: verify the sender/domain (SPF + DKIM) for
`EMAIL_FROM`; sign-in codes cannot be sent in production without it.

## 9. Backups and restore drills (PDF section 7)

```bash
sudo install -m 0755 deploy/backup/backup.sh /usr/local/bin/adhira-backup
sudo install -m 0755 deploy/backup/restore-drill.sh /usr/local/bin/adhira-restore-drill
sudo install -m 0755 deploy/monitoring/notify.sh /usr/local/bin/adhira-notify
sudo install -m 0755 deploy/monitoring/check.sh /usr/local/bin/adhira-monitor
sudo cp deploy/backup/backup.env.example /etc/adhira/backup.env && sudo chmod 600 /etc/adhira/backup.env   # then edit
sudo rclone config                                  # create the `gdrive` remote (dedicated backup account, MFA on)
openssl rand -base64 48 | sudo tee /etc/adhira/restic.pass >/dev/null && sudo chmod 600 /etc/adhira/restic.pass
#   >>> COPY restic.pass AND the rclone crypt password into the password manager NOW. <<<
sudo restic -r rclone:gdrive:adhira-restic --password-file /etc/adhira/restic.pass init
printf '[client]\nuser=adhira_backup\npassword=...\n' | sudo tee /etc/adhira/backup.cnf >/dev/null && sudo chmod 600 /etc/adhira/backup.cnf
sudo systemctl enable --now adhira-backup.timer adhira-monitor.timer
sudo systemctl start adhira-backup.service && journalctl -u adhira-backup -n 30
```

What runs daily (02:30 Dubai): `mysqldump --single-transaction --routines --events --triggers` →
gzip → restic (client-side AES-256) → offsite; a sanity check that the stored dump contains the
`orders` table; weekly additive `rclone copy` of R2 media to a separate encrypted remote (R2 is not
an independent backup); `restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune`;
`restic check`. Failures email `ALERT_EMAIL` via Brevo; the timer stops → `adhira-monitor` alerts
when the last good backup is older than 26 h; an optional `HEALTHCHECK_URL` dead-man switch covers
the whole VPS dying.

**Restore drill (quarterly, and after backup or schema changes):**
`sudo adhira-restore-drill` restores the newest snapshot into a throwaway database and checks
table count, orphan order items, order totals, triggers, admin accounts and sampled image URLs,
then logs the duration to `/var/log/adhira/restore-drill.log`. It needs a MySQL admin option file
at `/etc/adhira/drill-admin.cnf` (a user that can create/drop `adhira_drill_*` databases).
Full disaster procedure: `deploy/backup/RESTORE_RUNBOOK.md`.

## 10. Monitoring (PDF section 9)

`adhira-monitor` (every 5 min) checks app+DB health, disk ≥ 80 %, memory < 10 % free, backup age,
TLS expiry < 14 days, and that MySQL is not publicly bound; alerts once an hour per problem.
**Also** add an external monitor (UptimeRobot/BetterStack) on `https://adhiraflowers.ae/en` and the
TLS certificate: an in-server check cannot see "the VPS is down". Logs: `journalctl -u adhira`,
`/var/log/nginx/`, MySQL slow log.

## 11. Updating / rotating

- Deploy: `sudo -u deploy bash /srv/adhira/repo/deploy/scripts/deploy.sh <ref>`
- Rollback: `deploy/scripts/rollback.sh`
- Rotate a leaked secret: change it in `/etc/adhira/env`, `sudo systemctl restart adhira`; for R2
  revoke the token in Cloudflare first. Changing `AUTH_SECRET` invalidates MFA enrolments (re-enrol).
- OS patches: unattended-upgrades handle security updates, with an automatic 04:00 reboot when needed
  (the app and MySQL start on boot; check `systemctl status adhira` after).

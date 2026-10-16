# Restore runbook (disaster recovery)

Targets (agree + record in docs/LAUNCH_CHECKLIST.md): **RPO 24 h** (daily dump + 3 days of
binlogs), **RTO 8 h** for storefront + admin.

1. **Declare** an incident lead; write down the time and which recovery point you want.
   Stop checkout if data may be damaged: `sudo systemctl stop adhira` (or return 503 at Nginx).
2. **Provision** a clean Ubuntu host: `deploy/scripts/provision.sh`, then `deploy/mysql/create-users.sql`.
3. **Secrets** come from the password manager (never from a backup): `/etc/adhira/env`,
   `/etc/adhira/backup.env`, restic password, rclone config, Stripe/Brevo/R2 keys.
4. **Find the snapshot:** `restic snapshots --tag db`. Pick the newest good one.
5. **Restore the DB** into an isolated database first:
   ```bash
   restic dump <snapshot-id> adhira-db.sql.gz | gunzip > /root/restore.sql
   mysql -e "CREATE DATABASE adhira_restore CHARACTER SET utf8mb4"
   mysql adhira_restore < /root/restore.sql
   ```
   Validate (row counts, newest order, totals) -- `restore-drill.sh` does exactly this.
6. **Cut over:** `DROP DATABASE adhira; CREATE DATABASE adhira ...; mysql adhira < /root/restore.sql`
   (or rename). Re-run `create-users.sql` grants if needed. Replay binlogs if you need to
   recover past the dump: `mysqlbinlog --start-datetime=... | mysql adhira`.
7. **Media:** R2 is the live store. If the bucket was lost, `rclone copy media-crypt: r2:adhira-media`.
8. **Deploy the app:** `deploy/scripts/deploy.sh main`, confirm `/api/health`.
9. **Reconcile orders lost between the backup and the incident**: Stripe dashboard payments,
   confirmation emails sent, customer messages. Re-create or refund manually.
10. **Smoke test** a Stripe test-mode order (or the checkout error path if Stripe is off) + admin login before switching DNS / removing the 503.
11. **Rotate** any credential that may have been exposed; write the incident report.

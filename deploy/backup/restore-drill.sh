#!/usr/bin/env bash
# Restore drill: proves the newest backup downloads, decrypts and loads, and that
# the data inside is sane. Restores into a THROWAWAY database -- never production.
# Run quarterly, and after any backup change or major schema change:
#   sudo /usr/local/bin/adhira-restore-drill
# Records duration + results in /var/log/adhira/restore-drill.log.
set -Eeuo pipefail
CONF="${ADHIRA_BACKUP_ENV:-/etc/adhira/backup.env}"
set -a; . "$CONF"; set +a
MYSQL="${MYSQL:-mysql}"
LOG="${DRILL_LOG:-/var/log/adhira/restore-drill.log}"
mkdir -p "$(dirname "$LOG")"
NOTIFY="$(dirname "$(readlink -f "$0")")/../monitoring/notify.sh"
[ -x "$NOTIFY" ] || NOTIFY=/usr/local/bin/adhira-notify
DRILL_DB="adhira_drill_$(date +%s)"
ADMIN_DEFAULTS="${DRILL_ADMIN_DEFAULTS_FILE:-/etc/adhira/drill-admin.cnf}"   # a user able to CREATE/DROP adhira_drill_*
WORK="$(mktemp -d)"; chmod 700 "$WORK"
START=$(date +%s)

cleanup() { $MYSQL --defaults-extra-file="$ADMIN_DEFAULTS" -e "DROP DATABASE IF EXISTS \`$DRILL_DB\`" 2>/dev/null || true; rm -rf "$WORK"; }
fail() { echo "$(date -u +%FT%TZ) DRILL FAILED: $*" | tee -a "$LOG"; "$NOTIFY" "RESTORE DRILL FAILED on $(hostname)" "$*" || true; cleanup; exit 1; }
trap 'fail "line $LINENO: $BASH_COMMAND"' ERR

echo "[drill] fetching latest snapshot"
restic snapshots --tag db --host adhira --latest 1 --compact
restic dump latest adhira-db.sql.gz --tag db --host adhira > "$WORK/dump.sql.gz"
gunzip -t "$WORK/dump.sql.gz"
$MYSQL --defaults-extra-file="$ADMIN_DEFAULTS" -e "CREATE DATABASE \`$DRILL_DB\` CHARACTER SET utf8mb4"
gunzip -c "$WORK/dump.sql.gz" | $MYSQL --defaults-extra-file="$ADMIN_DEFAULTS" "$DRILL_DB"

q() { $MYSQL --defaults-extra-file="$ADMIN_DEFAULTS" -N -B "$DRILL_DB" -e "$1"; }
TABLES=$(q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DRILL_DB' AND table_type='BASE TABLE'")
ORDERS=$(q "SELECT COUNT(*) FROM orders")
ITEMS=$(q "SELECT COUNT(*) FROM order_items")
PRODUCTS=$(q "SELECT COUNT(*) FROM products")
IMAGES=$(q "SELECT COUNT(*) FROM product_images")
LATEST=$(q "SELECT COALESCE(MAX(created_at),'none') FROM orders")
ORPHANS=$(q "SELECT COUNT(*) FROM order_items oi LEFT JOIN orders o ON o.id=oi.order_id WHERE o.id IS NULL")
BADTOTALS=$(q "SELECT COUNT(*) FROM orders o WHERE ABS(o.total - (o.subtotal + o.vat + o.delivery_fee + o.deposit_total)) > 0.01")
TRIGGERS=$(q "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='$DRILL_DB'")
ADMINS=$(q "SELECT COUNT(*) FROM admin_users")

[ "$TABLES" -ge 18 ] || fail "only $TABLES tables restored"
[ "$ORPHANS" = "0" ] || fail "$ORPHANS order_items without an order"
[ "$BADTOTALS" = "0" ] || fail "$BADTOTALS orders whose totals don't add up"
[ "$TRIGGERS" -ge 2 ] || fail "triggers were not restored"
[ "$ADMINS" -ge 1 ] || fail "no admin accounts in the backup"

# Sample a few image URLs from the restored data to confirm media is reachable.
IMG_FAIL=0
for u in $(q "SELECT url FROM product_images ORDER BY RAND() LIMIT 3"); do
  curl -fsS -I -m 10 "$u" >/dev/null 2>&1 || IMG_FAIL=$((IMG_FAIL + 1))
done
[ "$IMG_FAIL" = "0" ] || fail "$IMG_FAIL sampled image URLs are not reachable"

DUR=$(( $(date +%s) - START ))
MSG="$(date -u +%FT%TZ) DRILL OK in ${DUR}s: tables=$TABLES orders=$ORDERS items=$ITEMS products=$PRODUCTS images=$IMAGES admins=$ADMINS latest_order=$LATEST"
echo "$MSG" | tee -a "$LOG"
cleanup

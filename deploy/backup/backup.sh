#!/usr/bin/env bash
# Daily encrypted offsite backup of the database (and, weekly, the R2 media).
# Installed as /usr/local/bin/adhira-backup, run by adhira-backup.timer.
#
#   mysqldump --single-transaction --routines --events --triggers
#     -> gzip -> restic (client-side AES-256 encryption, dedup) -> offsite repo
#     -> forget/prune 14 daily + 8 weekly + 12 monthly -> integrity check -> alert on failure
#
# Config in /etc/adhira/backup.env (root:root 0600), see deploy/backup/backup.env.example.
# The restic password and rclone crypt password MUST also be stored in the team
# password manager: without them the backups cannot be decrypted.
set -Eeuo pipefail
CONF="${ADHIRA_BACKUP_ENV:-/etc/adhira/backup.env}"
set -a; . "$CONF"; set +a
: "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD_FILE:?}" "${MYSQL_DEFAULTS_FILE:?}"
MYSQLDUMP="${MYSQLDUMP:-mysqldump}"
DB="${BACKUP_DB:-adhira}"
STATE_DIR="${STATE_DIR:-/var/lib/adhira}"
mkdir -p "$STATE_DIR"
NOTIFY="$(dirname "$(readlink -f "$0")")/../monitoring/notify.sh"
[ -x "$NOTIFY" ] || NOTIFY=/usr/local/bin/adhira-notify

fail() { echo "BACKUP FAILED: $*" >&2; "$NOTIFY" "BACKUP FAILED on $(hostname)" "$*" || true; exit 1; }
trap 'fail "line $LINENO: $BASH_COMMAND"' ERR

START=$(date +%s)
echo "[backup] dumping $DB"
# Credentials come from an option file (never argv/history). --no-tablespaces
# avoids needing the PROCESS privilege.
set -o pipefail
$MYSQLDUMP --defaults-extra-file="$MYSQL_DEFAULTS_FILE" \
  --single-transaction --routines --events --triggers \
  --no-tablespaces --default-character-set=utf8mb4 --hex-blob "$DB" \
  | gzip -9 \
  | restic backup --stdin --stdin-filename "adhira-db.sql.gz" --tag db --host adhira

# Sanity: the dump we just stored must contain the orders table definition.
# (awk reads the whole stream: `grep -q` would exit early and trip pipefail via SIGPIPE.)
restic dump latest adhira-db.sql.gz --tag db --host adhira | gunzip | awk '/^CREATE TABLE `orders`/ {f=1} END {exit !f}' \
  || fail "latest snapshot does not look like a valid dump"

# Weekly (Sunday): copy media objects to a separate encrypted remote. `copy` never
# deletes at the destination, so a compromised VPS can't wipe the media backup.
if [ "$(date +%u)" = "7" ] && [ -n "${MEDIA_SOURCE_REMOTE:-}" ]; then
  echo "[backup] media -> ${MEDIA_BACKUP_REMOTE}"
  rclone copy "$MEDIA_SOURCE_REMOTE" "$MEDIA_BACKUP_REMOTE" --transfers 8 --checksum
fi

restic forget --tag db --host adhira --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune
# Cheap integrity check every run; full data read on the 1st of the month.
restic check
[ "$(date +%d)" = "01" ] && restic check --read-data-subset=10% || true

date +%s > "$STATE_DIR/last-backup-ok"
echo "[backup] ok in $(( $(date +%s) - START ))s"
[ -z "${HEALTHCHECK_URL:-}" ] || curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL" >/dev/null || true

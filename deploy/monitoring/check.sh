#!/usr/bin/env bash
# Every 5 minutes (adhira-monitor.timer): app health, disk, memory, backup age, TLS expiry.
# Alerts at most once per hour per problem. This watches the server from the inside;
# ALSO configure an external uptime monitor (UptimeRobot/BetterStack) for
# https://adhiraflowers.ae/en and a TLS-expiry check, which detects "whole VPS is down".
set -uo pipefail
CONF="${ADHIRA_BACKUP_ENV:-/etc/adhira/backup.env}"
[ -r "$CONF" ] && { set -a; . "$CONF"; set +a; }
STATE_DIR="${STATE_DIR:-/var/lib/adhira}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
DISK_PATH="${DISK_PATH:-/}"
NOTIFY="$(dirname "$(readlink -f "$0")")/notify.sh"; [ -x "$NOTIFY" ] || NOTIFY=/usr/local/bin/adhira-notify
mkdir -p "$STATE_DIR/alerts"
problems=()

alert() { # key, message  (dedupe: once per hour)
  local f="$STATE_DIR/alerts/$1" now; now=$(date +%s)
  if [ ! -f "$f" ] || [ $((now - $(cat "$f"))) -gt 3600 ]; then echo "$now" > "$f"; "$NOTIFY" "ADHIRA: $2" "$2 (host $(hostname), $(date -u +%FT%TZ))"; fi
  problems+=("$2")
}
clear_alert() { rm -f "$STATE_DIR/alerts/$1"; }

# 1. app + database reachable (two tries to ride out a restart)
if curl -fsS -m 8 "$HEALTH_URL" | grep -q '"ok"' || { sleep 5; curl -fsS -m 8 "$HEALTH_URL" | grep -q '"ok"'; }; then clear_alert app
else alert app "App/database health check failing"; fi

# 2. disk > 80%
used=$(df --output=pcent "$DISK_PATH" | tail -1 | tr -dc '0-9')
if [ "${used:-0}" -ge "${DISK_ALERT_PCT:-80}" ]; then alert disk "Disk ${used}% full on $DISK_PATH"; else clear_alert disk; fi

# 3. memory pressure (< 10% available)
avail=$(awk '/MemAvailable/ {a=$2} /MemTotal/ {t=$2} END {printf "%d", a*100/t}' /proc/meminfo)
if [ "${avail:-100}" -lt 10 ]; then alert mem "Only ${avail}% memory available"; else clear_alert mem; fi

# 4. backup age (daily job: alert past 26h) -- catches a timer that silently stopped
if [ -f "$STATE_DIR/last-backup-ok" ]; then
  age=$(( $(date +%s) - $(cat "$STATE_DIR/last-backup-ok") ))
  if [ "$age" -gt $(( ${BACKUP_MAX_AGE_HOURS:-26} * 3600 )) ]; then alert backup "Last good backup is $((age / 3600))h old"; else clear_alert backup; fi
else alert backup "No successful backup recorded yet"; fi

# 5. TLS certificate expiry (< 14 days)
if [ -n "${TLS_HOST:-adhiraflowers.ae}" ] && command -v openssl >/dev/null; then
  end=$(echo | openssl s_client -servername "${TLS_HOST:-adhiraflowers.ae}" -connect "${TLS_HOST:-adhiraflowers.ae}:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$end" ]; then
    days=$(( ($(date -d "$end" +%s) - $(date +%s)) / 86400 ))
    if [ "$days" -lt 14 ]; then alert tls "TLS certificate expires in ${days} days"; else clear_alert tls; fi
  fi
fi

# 6. MySQL not exposed
if ss -ltn 2>/dev/null | grep ':3306' | grep -vq '127.0.0.1'; then alert mysqlexp "MySQL is listening on a non-loopback address!"; else clear_alert mysqlexp; fi

[ ${#problems[@]} -eq 0 ] && exit 0 || { printf '%s\n' "${problems[@]}" >&2; exit 1; }

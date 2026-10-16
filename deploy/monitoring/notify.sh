#!/usr/bin/env bash
# adhira-notify "<subject>" "<body>"  -> email via Brevo (transactional API).
# Reads BREVO_API_KEY, ALERT_EMAIL, ALERT_FROM from /etc/adhira/backup.env.
# Always prints to stderr so journald keeps a copy even if email fails.
set -uo pipefail
SUBJECT="${1:-adhira alert}"; BODY="${2:-}"
echo "[ALERT] $SUBJECT :: $BODY" >&2
CONF="${ADHIRA_BACKUP_ENV:-/etc/adhira/backup.env}"
[ -r "$CONF" ] && { set -a; . "$CONF"; set +a; }
[ -n "${BREVO_API_KEY:-}" ] && [ -n "${ALERT_EMAIL:-}" ] || exit 0
payload=$(python3 - "$SUBJECT" "$BODY" <<'PY'
import json, os, sys
print(json.dumps({
  "sender": {"email": os.environ.get("ALERT_FROM", "alerts@adhiraflowers.ae"), "name": "Adhira alerts"},
  "to": [{"email": os.environ["ALERT_EMAIL"]}],
  "subject": sys.argv[1],
  "textContent": sys.argv[2],
}))
PY
)
curl -fsS -m 15 -X POST https://api.brevo.com/v3/smtp/email \
  -H "api-key: $BREVO_API_KEY" -H "Content-Type: application/json" -d "$payload" >/dev/null \
  || echo "[ALERT] email delivery failed" >&2

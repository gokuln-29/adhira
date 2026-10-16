#!/usr/bin/env bash
# Point `current` at an earlier release and restart. Code only: if the bad
# release ran a migration, it was written to be backward compatible, so the old
# code still works. Do NOT restore the database unless data is damaged (it would
# discard orders placed since the backup -- reconcile with Stripe + email first).
#   ./rollback.sh            -> previous release
#   ./rollback.sh 20261016-101500
set -euo pipefail
ROOT=/srv/adhira
CUR="$(readlink -f "$ROOT/current")"
if [ -n "${1:-}" ]; then TARGET="$ROOT/releases/$1/run"
else TARGET="$(ls -1dt "$ROOT"/releases/*/run | grep -v -x "$CUR" | head -1)"; fi
[ -d "$TARGET" ] || { echo "No such release: $TARGET"; exit 1; }
echo "Rolling back $CUR -> $TARGET"
ln -sfn "$TARGET" "$ROOT/current.new" && mv -Tf "$ROOT/current.new" "$ROOT/current"
sudo /bin/systemctl restart adhira
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:3000/api/health | grep -q '"ok"' && { echo "healthy"; exit 0; }
  sleep 1
done
echo "Rolled back but health check failed -- investigate: journalctl -u adhira -n 100"; exit 1

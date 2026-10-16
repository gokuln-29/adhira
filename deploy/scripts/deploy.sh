#!/usr/bin/env bash
# Release deploy on the VPS. Run as the `adhira` deploy user (needs sudo only for
# `systemctl restart adhira`, granted in /etc/sudoers.d/adhira).
#
#   ./deploy.sh <git-ref>        e.g. ./deploy.sh main   or   ./deploy.sh v1.4.0
#
# Layout:  /srv/adhira/{repo, releases/<id>, current -> releases/<id>, shared}
# Order:   build -> DB backup -> migrate -> smoke-test NEW release on a spare
#          port -> flip symlink -> restart -> health check -> auto-rollback on failure.
# Apply migrations BEFORE the new code serves traffic; keep them backward compatible
# (expand/contract) so the previous release still runs against the new schema.
set -euo pipefail

REF="${1:?usage: deploy.sh <git-ref>}"
ROOT=/srv/adhira
ENV_FILE=/etc/adhira/env
KEEP=5
ID="$(date -u +%Y%m%d-%H%M%S)"
REL="$ROOT/releases/$ID"
PREV="$(readlink -f "$ROOT/current" 2>/dev/null || true)"
log() { printf '\n[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

[ "$(id -u)" -ne 0 ] || { echo "Do not deploy as root."; exit 1; }
[ -r "$ENV_FILE" ] || { echo "Missing $ENV_FILE"; exit 1; }
set -a; . "$ENV_FILE"; set +a
: "${DATABASE_MIGRATE_URL:?set DATABASE_MIGRATE_URL in $ENV_FILE}"
: "${NEXT_PUBLIC_SITE_URL:?set NEXT_PUBLIC_SITE_URL in $ENV_FILE}"

log "Fetching $REF"
[ -d "$ROOT/repo/.git" ] || git clone "$(cat "$ROOT/repo.url")" "$ROOT/repo"
git -C "$ROOT/repo" fetch --prune origin
mkdir -p "$REL"
git -C "$ROOT/repo" archive "$(git -C "$ROOT/repo" rev-parse "origin/$REF" 2>/dev/null || git -C "$ROOT/repo" rev-parse "$REF")" | tar -x -C "$REL"

log "Installing + building (lockfile install, secrets not baked in)"
cd "$REL"
npm ci --no-audit --no-fund
# The build prerenders pages from MySQL, so it needs DATABASE_URL (localhost).
npm run build
# Standalone output needs static assets + public copied beside server.js.
cp -r .next/static .next/standalone/.next/static
[ -d public ] && cp -r public .next/standalone/public
# The self-contained server we actually run lives in $REL/run.
mkdir -p "$REL/run" && cp -r .next/standalone/. "$REL/run/"
rm -rf "$REL/run/.next/cache" && ln -s /var/cache/adhira "$REL/run/.next/cache"

if [ -x /usr/local/bin/adhira-backup ]; then
  log "Pre-deploy database backup"
  /usr/local/bin/adhira-backup
else
  echo "WARNING: /usr/local/bin/adhira-backup missing, deploying without a fresh backup"
fi

log "Applying migrations"
DATABASE_MIGRATE_URL="$DATABASE_MIGRATE_URL" npx tsx scripts/db-migrate.ts

log "Smoke-testing the new release on :3100"
( cd "$REL/run" && PORT=3100 HOSTNAME=127.0.0.1 NODE_ENV=production node server.js ) > "$REL/smoke.log" 2>&1 &
SMOKE_PID=$!
trap 'kill $SMOKE_PID 2>/dev/null || true' EXIT
ok=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3100/api/health | grep -q '"ok"'; then ok=1; break; fi
  sleep 1
done
if [ "$ok" -ne 1 ]; then
  echo "Smoke test FAILED. Log tail:"; tail -30 "$REL/smoke.log"
  kill $SMOKE_PID 2>/dev/null || true
  rm -rf "$REL"
  exit 1
fi
curl -fsS -o /dev/null http://127.0.0.1:3100/en && curl -fsS -o /dev/null http://127.0.0.1:3100/ar
kill $SMOKE_PID 2>/dev/null || true; trap - EXIT

log "Switching to $ID"
ln -sfn "$REL/run" "$ROOT/current.new" && mv -Tf "$ROOT/current.new" "$ROOT/current"
echo "$ID" > "$ROOT/current.id"
sudo /bin/systemctl restart adhira

log "Health check"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health | grep -q '"ok"'; then ok=1; break; fi
  sleep 1
done
if [ "$ok" -ne 1 ]; then
  echo "Health check FAILED -> rolling back to $PREV"
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    ln -sfn "$PREV" "$ROOT/current.new" && mv -Tf "$ROOT/current.new" "$ROOT/current"
    sudo /bin/systemctl restart adhira
  fi
  exit 1
fi

log "Pruning old releases (keeping $KEEP)"
ls -1dt "$ROOT"/releases/* | tail -n +$((KEEP + 1)) | xargs -r rm -rf
log "Deployed $ID"

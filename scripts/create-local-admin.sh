#!/bin/bash
# Creates a local-dev admin user + admin_users row.
# Needed after every `supabase db reset` / `supabase start` from scratch,
# since `auth.users` is wiped along with the rest of the local DB and can't
# be seeded via plain SQL (passwords must go through the Auth Admin API).
set -euo pipefail

EMAIL="${1:-admin@flowersandgifts.ae}"
PASSWORD="${2:-AdminDev123!}"
NAME="${3:-Dev Admin}"

SERVICE_KEY=$(supabase status -o json | python3 -c "import sys,json;print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")

USER_ID=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
  "insert into admin_users (auth_user_id, name, role) values ('$USER_ID', '$NAME', 'owner');"

echo "Admin created: $EMAIL / $PASSWORD"

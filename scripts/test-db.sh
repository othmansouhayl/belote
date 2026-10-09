#!/usr/bin/env bash
# Teste les migrations Supabase et les règles de sécurité (RLS) sur un Postgres local jetable.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
[ -n "$PGBIN" ] || PGBIN="$(pg_config --bindir)"
PORT="${TEST_DB_PORT:-54329}"
WORK="$(mktemp -d)"

as_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

[ "$(id -u)" = "0" ] && chown postgres "$WORK"
as_pg "$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust -E UTF8 >/dev/null
as_pg "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses='' -c wal_level=logical" -l "$WORK/log" -w start >/dev/null
trap 'as_pg "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null; rm -rf "$WORK"' EXIT

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$ROOT/supabase/tests/supabase_stubs.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$migration"
done
"${PSQL[@]}" -f "$ROOT/supabase/tests/rls_test.sql"

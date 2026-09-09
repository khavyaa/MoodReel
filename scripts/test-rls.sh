#!/usr/bin/env bash
#
# Verifies supabase/migrations against a throwaway Postgres:
#   1. the migration applies cleanly, and is safe to re-run
#   2. the profile-creation trigger fires on signup
#   3. RLS actually isolates users - no cross-user read or write
#
# Needs Docker. Nothing here touches your real Supabase project.
set -euo pipefail

CONTAINER="moodreel-rls-test"
IMAGE="postgres:16"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> starting $IMAGE"
cleanup
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=pw "$IMAGE" >/dev/null

for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

docker cp "$ROOT/supabase/tests/auth-stub.sql"        "$CONTAINER:/tmp/" >/dev/null
docker cp "$ROOT/supabase/migrations/0001_init.sql"   "$CONTAINER:/tmp/" >/dev/null
docker cp "$ROOT/supabase/tests/rls.test.sql"         "$CONTAINER:/tmp/" >/dev/null

run() { docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 "$@"; }

echo "==> stubbing the auth schema"
run -q -f /tmp/auth-stub.sql

echo "==> applying migration"
run -q -f /tmp/0001_init.sql

echo "==> re-applying migration (must be idempotent)"
run -q -f /tmp/0001_init.sql

echo "==> RLS isolation"
# Captured once: the suite mutates the database, so a second run would not see
# the same state. `set -e` is lifted here because a failing suite is a result to
# report, not a reason to abort before reporting it.
set +e
output="$(run -f /tmp/rls.test.sql 2>&1)"
psql_status=$?
set -e

echo "$output" \
  | grep -v '^SET$\|^GRANT$\|^INSERT 0\|^CREATE FUNCTION$\|Pager usage' \
  | sed 's/^psql.*NOTICE:  //'

failed=0
[ "$psql_status" -ne 0 ] && failed=1
echo "$output" | grep -q "FAIL " && failed=1
# A suite that asserted nothing is broken, not passing.
echo "$output" | grep -q "PASS " || failed=1

if [ "$failed" -ne 0 ]; then
  echo
  echo "!! RLS verification FAILED"
  [ "$psql_status" -ne 0 ] && echo "   psql exited $psql_status"
  echo "$output" | grep -E "FAIL |ERROR:" | sed 's/^psql.*NOTICE:  //' | sed 's/^/   /'
  exit 1
fi

echo "==> all RLS checks passed ($(echo "$output" | grep -c "PASS ") assertions)"

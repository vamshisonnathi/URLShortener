#!/usr/bin/env bash
#
# verify-scenarios.sh — smoke-verify the three engineering scenarios end-to-end
# against a running instance (see SCENARIOS.md).
#
# Usage:
#   ./scripts/verify-scenarios.sh                 # targets http://localhost:3000
#   BASE_URL=http://host:port ./scripts/verify-scenarios.sh
#
# Requires: the stack running (`docker compose up`) + curl. Exits non-zero if any
# check fails, so it is CI-friendly.

set -u
BASE_URL="${BASE_URL:-http://localhost:3000}"

pass=0
fail=0
green() { printf '\033[32m%s\033[0m' "$1"; }
red() { printf '\033[31m%s\033[0m' "$1"; }

# check <label> <expected> <actual>
check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    printf '  [%s] %-46s expected=%s got=%s\n' "$(green PASS)" "$label" "$expected" "$actual"
    pass=$((pass + 1))
  else
    printf '  [%s] %-46s expected=%s got=%s\n' "$(red FAIL)" "$label" "$expected" "$actual"
    fail=$((fail + 1))
  fi
}

# HTTP status of a POST /api/shorten with the given JSON body.
shorten_status() {
  curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/shorten" \
    -H 'content-type: application/json' -d "$1"
}

# Extract shortCode from a POST /api/shorten response body.
shorten_code() {
  curl -s -X POST "$BASE_URL/api/shorten" -H 'content-type: application/json' -d "$1" \
    | sed -n 's/.*"shortCode":"\([^"]*\)".*/\1/p'
}

# Status of a plain GET.
get_status() {
  curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/$1"
}

echo "Target: $BASE_URL"

# --- Preflight: is the service up? ---
if ! curl -sf "$BASE_URL/health" >/dev/null 2>&1; then
  echo "$(red 'ERROR') service not reachable at $BASE_URL/health — start it with 'docker compose up'." >&2
  exit 2
fi

# ---------------------------------------------------------------------------
echo
echo "Scenario 1 — Greenfield: shorten -> 302 redirect -> analytics"
TARGET="https://example.com/greenfield?run=$RANDOM"
CODE=$(shorten_code "{\"url\":\"$TARGET\"}")
check "shorten returns a 7-char code" "7" "${#CODE}"

# redirect: expect 302 and a Location matching the original URL
REDIR=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/$CODE" \
  -H 'cf-ipcountry: US' -H 'referer: https://news.ycombinator.com/')
check "GET /:code redirects (302)" "302" "$REDIR"
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE_URL/$CODE" \
  -H 'cf-ipcountry: US' -H 'referer: https://news.ycombinator.com/')
check "redirect Location is the original URL" "$TARGET" "$LOC"

# analytics: the click write is async — poll briefly for totalClicks >= 1
TOTAL=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  TOTAL=$(curl -s "$BASE_URL/api/analytics/$CODE" \
    | sed -n 's/.*"totalClicks":\([0-9]*\).*/\1/p')
  [ "${TOTAL:-0}" -ge 1 ] 2>/dev/null && break
  sleep 0.3
done
check "analytics records >= 1 click" "yes" "$([ "${TOTAL:-0}" -ge 1 ] && echo yes || echo no)"
COUNTRY=$(curl -s "$BASE_URL/api/analytics/$CODE" | grep -c '"country":"US"')
check "analytics attributes country (US)" "1" "$COUNTRY"

# ---------------------------------------------------------------------------
echo
echo "Scenario 2 — Brownfield: reserved-alias route shadowing is fixed"
check "alias 'health' rejected (400)" "400" "$(shorten_status '{"url":"https://x.com","customAlias":"health"}')"
check "alias 'api' rejected (400)"    "400" "$(shorten_status '{"url":"https://x.com","customAlias":"api"}')"
check "alias 'HEALTH' rejected (case-insensitive)" "400" "$(shorten_status '{"url":"https://x.com","customAlias":"HEALTH"}')"
check "system route /health unaffected (200)" "200" "$(get_status health)"
# Unique alias (PID + epoch) so repeated runs never collide (409).
NALIAS="ok$$$(date +%s)"
NBODY="{\"url\":\"https://x.com\",\"customAlias\":\"$NALIAS\"}"
NRESP=$(curl -s -w '\n%{http_code}' -X POST "$BASE_URL/api/shorten" -H 'content-type: application/json' -d "$NBODY")
NSTATUS=$(printf '%s' "$NRESP" | tail -n1)
check "normal alias still works (201)" "201" "$NSTATUS"
[ "$NSTATUS" = "201" ] || printf '        (alias=%s response=%s)\n' "$NALIAS" "$(printf '%s' "$NRESP" | head -n1)"

# ---------------------------------------------------------------------------
echo
echo "Scenario 3 — Ambiguous: same URL -> distinct codes (no dedup, by decision)"
DUP="https://dup.example.com/$RANDOM"
A=$(shorten_code "{\"url\":\"$DUP\"}")
B=$(shorten_code "{\"url\":\"$DUP\"}")
check "two shortens of one URL are distinct" "yes" "$([ -n "$A" ] && [ "$A" != "$B" ] && echo yes || echo no)"

# ---------------------------------------------------------------------------
echo
echo "-----------------------------------------------------"
printf 'Result: %s passed, %s failed\n' "$(green "$pass")" "$([ "$fail" -eq 0 ] && green 0 || red "$fail")"
[ "$fail" -eq 0 ] && exit 0 || exit 1

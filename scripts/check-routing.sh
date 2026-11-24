#!/usr/bin/env bash
# scripts/check-routing.sh
#
# Verifies that Traefik is routing correctly for marketpaq.com:
#   /api/*  → backend Fastify   (Content-Type: application/json)
#   /       → frontend SPA      (Content-Type: text/html)
#
# Usage:
#   bash scripts/check-routing.sh                              # production
#   bash scripts/check-routing.sh https://pr-9.marketpaq.com  # PR preview

set -euo pipefail

BASE="${1:-https://marketpaq.com}"
FAIL=0

check() {
  local label="$1"
  local path="$2"
  local expected_ct="$3"
  local url="${BASE}${path}"

  # Use GET (not HEAD: some servers return text/plain for HEAD).
  # -4              force IPv4 — avoids IPv6 routing differences on dual-stack hosts.
  # -o /dev/null    discard body.
  # -D -            dump response headers to stdout.
  # -L              follow redirects.
  # -A              set a recognisable User-Agent.
  local raw_headers
  raw_headers=$(curl -4 -sSL --max-time 10 \
    --retry 2 --retry-delay 3 \
    -A 'marketpaq-routing-check/1.0' \
    -o /dev/null \
    -D - \
    "${url}" 2>/dev/null || true)

  local status ct
  status=$(printf '%s' "${raw_headers}" \
    | grep -i '^HTTP/' | tail -1 | tr -d '\r' | awk '{print $2}')

  ct=$(printf '%s' "${raw_headers}" \
    | grep -i '^content-type:' \
    | tail -1 \
    | tr -d '\r' \
    | sed 's/^[Cc]ontent-[Tt]ype:[[:space:]]*//' \
    | cut -d';' -f1 \
    | tr '[:upper:]' '[:lower:]' \
    | xargs)

  if printf '%s' "${ct}" | grep -qF "${expected_ct}"; then
    printf "  PASS  %-28s  HTTP %-3s  Content-Type: %s\n" "${label}" "${status}" "${ct}"
  else
    printf "  FAIL  %-28s  HTTP %-3s  expected '%s', got '%s'\n" \
      "${label}" "${status}" "${expected_ct}" "${ct}"
    FAIL=1
  fi
}

echo "Checking routing for ${BASE}"
echo "──────────────────────────────────────────────────"
check "GET /api/health"     "/api/health"     "application/json"
check "GET /api/v1/config"  "/api/v1/config"  "application/json"
check "GET /"               "/"               "text/html"
echo "──────────────────────────────────────────────────"

if [ "${FAIL}" -eq 0 ]; then
  echo "All checks passed."
else
  echo ""
  echo "One or more checks FAILED."
  echo "See troubleshooting checklist: infra/backend/README.md"
  exit 1
fi

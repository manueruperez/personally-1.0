#!/usr/bin/env bash
# Smoke test post-deploy. Uso: ./smoke.sh demo.tudominio.com
set -euo pipefail

DOMAIN="${1:-${DOMAIN:-}}"
if [[ -z "$DOMAIN" ]]; then
  echo "Uso: ./smoke.sh <dominio>  (ej: ./smoke.sh demo.tudominio.com)" >&2
  exit 1
fi

BASE="https://${DOMAIN}"
fail=0

check() {
  local desc="$1" expected="$2" url="$3"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url")
  if [[ "$code" == "$expected" ]]; then
    echo "✅ $desc ($code)"
  else
    echo "❌ $desc — esperaba $expected, recibió $code ($url)"
    fail=1
  fi
}

check "API health"                          200 "$BASE/health"
check "GoTrue health (via /auth/v1)"        200 "$BASE/auth/v1/health"
check "Frontend (SPA index)"                200 "$BASE/"
check "SPA fallback (ruta interna)"         200 "$BASE/clients"
check "API sin token rechaza"               401 "$BASE/api/v1/me"
check "Rutas internas bloqueadas en edge"   403 "$BASE/api/v1/internal/outbox/next"

if [[ "$fail" == 0 ]]; then
  echo "— smoke OK —"
else
  echo "— smoke FALLÓ —" >&2
  exit 1
fi

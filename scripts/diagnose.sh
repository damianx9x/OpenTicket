#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
REPORT_DIR="$RUNTIME_DIR/reports"
PID_DIR="$RUNTIME_DIR/pids"
ENV_FILE="$RUNTIME_DIR/env"
FALLBACK_TEST_LOG_DIR="$ROOT_DIR/Moj/testy/runtime/logs"
mkdir -p "$REPORT_DIR" "$LOG_DIR" "$PID_DIR"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
BACKEND_HEALTH_HOST="${BACKEND_HEALTH_HOST:-127.0.0.1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-DevLocal123!}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$REPORT_DIR/diagnose-$TIMESTAMP.txt"

BUNDLE=0
OPEN_MAIL=""
VERBOSE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle)
      BUNDLE=1
      shift
      ;;
    --open-mail)
      OPEN_MAIL="${2:-}"
      shift 2
      ;;
    --verbose)
      VERBOSE=1
      shift
      ;;
    *)
      echo "[diagnose] unknown arg: $1"
      shift
      ;;
  esac
done

safe_cmd() {
  local title="$1"
  shift
  {
    echo ""
    echo "=== $title ==="
    "$@" 2>&1 || true
  } >> "$REPORT_FILE"
}

{
  echo "OpenTicket Diagnostic Report"
  echo "generated_at=$(date -u +%FT%TZ)"
  echo "root=$ROOT_DIR"
} > "$REPORT_FILE"

safe_cmd "System" uname -a
safe_cmd "Node version" node -v
safe_cmd "NPM version" npm -v
safe_cmd "Git status" git -C "$ROOT_DIR" status -sb
safe_cmd "Git HEAD" git -C "$ROOT_DIR" log --oneline -n 1
safe_cmd "Relevant env" env
safe_cmd "PID files" ls -la "$PID_DIR"
safe_cmd "Process list" ps aux
safe_cmd "Listening ports" lsof -nP -iTCP -sTCP:LISTEN
safe_cmd "Backend health (IPv4)" curl -i -sS "http://${BACKEND_HEALTH_HOST}:${BACKEND_PORT}/api/v1/health"
safe_cmd "Backend health (IPv6)" curl -g -i -sS "http://[::1]:${BACKEND_PORT}/api/v1/health"
safe_cmd "Setup status" curl -i -sS -X POST "http://${BACKEND_HEALTH_HOST}:${BACKEND_PORT}/api/v1/setup/status"
safe_cmd "System info" curl -i -sS "http://${BACKEND_HEALTH_HOST}:${BACKEND_PORT}/api/v1/system/info"

AUTH_HEADER=""
LOGIN_JSON="$(curl -sS -X POST "http://${BACKEND_HEALTH_HOST}:${BACKEND_PORT}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" || true)"
AUTH_TOKEN="$(node -e 'try{const x=JSON.parse(process.argv[1]);process.stdout.write((x.data&&x.data.token)||x.token||"")}catch{process.stdout.write("")}' "$LOGIN_JSON" 2>/dev/null || true)"
if [[ -n "$AUTH_TOKEN" ]]; then
  AUTH_HEADER="Authorization: Bearer $AUTH_TOKEN"
fi

{
  echo ""
  echo "=== Diagnostics report ==="
  if [[ -n "$AUTH_HEADER" ]]; then
    curl -i -sS "http://${BACKEND_HEALTH_HOST}:${BACKEND_PORT}/api/v1/diagnostics/report" -H "$AUTH_HEADER" || true
  else
    echo "No auth token available for diagnostics report (expected before setup/login)."
    curl -i -sS "http://${BACKEND_HEALTH_HOST}:${BACKEND_PORT}/api/v1/diagnostics/report" || true
  fi
} >> "$REPORT_FILE"

{
  BACKEND_LOG_FILE="$LOG_DIR/backend.log"
  FRONTEND_LOG_FILE="$LOG_DIR/frontend.log"
  DESKTOP_LOG_FILE="$LOG_DIR/desktop.log"

  if [[ ! -f "$BACKEND_LOG_FILE" && -f "$FALLBACK_TEST_LOG_DIR/backend.log" ]]; then
    BACKEND_LOG_FILE="$FALLBACK_TEST_LOG_DIR/backend.log"
  fi
  if [[ ! -f "$FRONTEND_LOG_FILE" && -f "$FALLBACK_TEST_LOG_DIR/frontend.log" ]]; then
    FRONTEND_LOG_FILE="$FALLBACK_TEST_LOG_DIR/frontend.log"
  fi
  if [[ ! -f "$DESKTOP_LOG_FILE" && -f "$FALLBACK_TEST_LOG_DIR/desktop.log" ]]; then
    DESKTOP_LOG_FILE="$FALLBACK_TEST_LOG_DIR/desktop.log"
  fi

  echo ""
  echo "=== Tail backend.log ($BACKEND_LOG_FILE) ==="
  if [[ -f "$BACKEND_LOG_FILE" ]]; then
    tail -n 200 "$BACKEND_LOG_FILE" 2>&1 || true
  else
    echo "backend.log not found"
  fi
  echo ""
  echo "=== Tail frontend.log ($FRONTEND_LOG_FILE) ==="
  if [[ -f "$FRONTEND_LOG_FILE" ]]; then
    tail -n 200 "$FRONTEND_LOG_FILE" 2>&1 || true
  else
    echo "frontend.log not found"
  fi
  echo ""
  echo "=== Tail desktop.log ($DESKTOP_LOG_FILE) ==="
  if [[ -f "$DESKTOP_LOG_FILE" ]]; then
    tail -n 200 "$DESKTOP_LOG_FILE" 2>&1 || true
  else
    echo "desktop.log not found"
  fi
} >> "$REPORT_FILE"

echo "[diagnose] report: $REPORT_FILE"
if [[ "$VERBOSE" -eq 1 ]]; then
  tail -n 80 "$REPORT_FILE"
fi

if [[ "$BUNDLE" -eq 1 ]]; then
  BUNDLE_FILE="$REPORT_DIR/diagnose-$TIMESTAMP.tar.gz"
  tar -czf "$BUNDLE_FILE" -C "$RUNTIME_DIR" logs reports pids 2>/dev/null || tar -czf "$BUNDLE_FILE" -C "$RUNTIME_DIR" logs reports
  echo "[diagnose] bundle: $BUNDLE_FILE"
fi

if [[ -n "$OPEN_MAIL" ]]; then
  BODY="Diagnostic report generated: $REPORT_FILE"
  if command -v python3 >/dev/null 2>&1; then
    ENCODED_BODY="$(python3 - <<'PY'
import urllib.parse
print(urllib.parse.quote("Diagnostic report generated. Please attach the generated file from .runtime/reports."))
PY
)"
  else
    ENCODED_BODY="Diagnostic%20report%20generated."
  fi
  if command -v open >/dev/null 2>&1; then
    open "mailto:${OPEN_MAIL}?subject=OpenTicket%20Diagnostics&body=${ENCODED_BODY}" || true
    echo "[diagnose] opened mail draft for $OPEN_MAIL"
  else
    echo "[diagnose] mail draft not supported on this OS"
  fi
fi

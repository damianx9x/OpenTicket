#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$ROOT_DIR/Moj/testy/runtime"
ENV_FILE="$TEST_ROOT/env"
REPORT_DIR="$TEST_ROOT/reports"
LOG_DIR="$TEST_ROOT/logs"

PORT="3200"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/diagnose-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "Moj/testy diagnose"
  echo "generated_at=$(date -u +%FT%TZ)"
  echo "port=$PORT"
  echo
  echo "=== versions ==="
  node -v || true
  npm -v || true
  echo
  echo "=== health ==="
  curl -i -sS "http://127.0.0.1:${PORT}/api/v1/health" || true
  echo
  echo "=== setup status ==="
  curl -i -sS -X POST "http://127.0.0.1:${PORT}/api/v1/setup/status" || true
  echo
  echo "=== system info ==="
  curl -i -sS "http://127.0.0.1:${PORT}/api/v1/system/info" || true
  echo
  echo "=== processes ==="
  lsof -nP -iTCP:${PORT} -sTCP:LISTEN || true
  echo
  echo "=== backend log tail ==="
  tail -n 200 "$LOG_DIR/backend.log" || true
} > "$REPORT"

echo "[Moj/testy] report: $REPORT"

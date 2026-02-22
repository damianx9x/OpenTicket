#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT_DIR="$ROOT_DIR/Moj/testy/runtime/reports"
mkdir -p "$REPORT_DIR"

BROWSER="${BROWSER:-chromium}"
ITERATIONS="${ITERATIONS:-10}"
PASSED=0

for i in $(seq 1 "$ITERATIONS"); do
  echo "[Moj/testy][fresh-10x] run $i/$ITERATIONS"
  "$ROOT_DIR/Moj/testy/start.sh" --fresh --no-open >/tmp/openticket-fresh10x-start-$i.log 2>&1

  if node "$ROOT_DIR/Moj/testy/ui-random-10.mjs" --browser "$BROWSER" --iterations 10 >/tmp/openticket-fresh10x-ui-$i.log 2>&1; then
    PASSED=$((PASSED + 1))
  else
    echo "[Moj/testy][fresh-10x] FAIL at run $i"
    tail -n 120 /tmp/openticket-fresh10x-start-$i.log || true
    tail -n 120 /tmp/openticket-fresh10x-ui-$i.log || true
    exit 1
  fi
done

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_PATH="$REPORT_DIR/fresh-10x-smoke-$STAMP.json"
cat > "$REPORT_PATH" <<JSON
{
  "name": "fresh-10x-smoke",
  "status": "PASS",
  "browser": "${BROWSER}",
  "iterations": ${ITERATIONS},
  "passed": ${PASSED},
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo "[Moj/testy][fresh-10x] RESULT ${PASSED}/${ITERATIONS} PASS report=$REPORT_PATH"

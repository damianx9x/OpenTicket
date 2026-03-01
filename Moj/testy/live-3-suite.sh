#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/docs/test-reports/live-3-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT_DIR"

run_case() {
  local id="$1"
  shift
  echo "[live-3] >>> $id"
  set +e
  "$@" 2>&1 | tee "$OUT_DIR/${id}.log"
  local code=${PIPESTATUS[0]}
  set -e
  if [[ $code -ne 0 ]]; then
    echo "[live-3] FAIL: $id"
    exit "$code"
  fi
  echo "[live-3] PASS: $id"
}

# Live #1: fresh setup + user flow (operator perspective)
run_case "01-fresh-install-usage" "$ROOT_DIR/Moj/testy/full-install-usage-smoke.sh"

# Live #2: client connects to running server instance (remote-like scenario)
run_case "02-client-connect-server" "$ROOT_DIR/Moj/testy/client-connect-installed-server.sh"

# Live #3: backup export/import + integrity verification
run_case "03-disaster-restore" "$ROOT_DIR/Moj/testy/disaster-restore-live.sh"

cat > "$OUT_DIR/SUMMARY.md" <<MD
# Live 3 Suite

- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Policy: 3 scenariusze live (zgodnie z planem remote-host)
- Status: PASS

## Cases
1. Fresh install + setup + operator flow
2. Client -> running server
3. Disaster restore + backup integrity verification
MD

echo "[live-3] DONE: $OUT_DIR/SUMMARY.md"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT_DIR="$ROOT_DIR/.runtime/reports"
STAMP="$(date +%Y%m%d-%H%M%S)"
SUMMARY_PATH="$REPORT_DIR/platform-matrix-smoke-$STAMP.json"

mkdir -p "$REPORT_DIR"

steps=(
  "clean-user-macos:node scripts/ci/clean-user-account-smoke.mjs --platform=macos"
  "clean-user-windows-sim:node scripts/ci/clean-user-account-smoke.mjs --platform=windows"
  "ios-usb-check:./Moj/testy/ios-usb-check.sh"
  "ios-swift-typecheck:./scripts/ci/ios-swift-typecheck.sh"
  "ios-contract-smoke:node scripts/ci/ios-contract-smoke.mjs"
  "release-artifacts:./scripts/ci/release-artifacts-smoke.sh"
)

docker_ready() {
  command -v docker >/dev/null 2>&1 || return 1
  docker info >/dev/null 2>&1 &
  local info_pid=$!
  local waited=0
  local timeout_seconds=8
  while kill -0 "$info_pid" >/dev/null 2>&1; do
    sleep 1
    waited=$((waited + 1))
    if [[ "$waited" -ge "$timeout_seconds" ]]; then
      kill "$info_pid" >/dev/null 2>&1 || true
      wait "$info_pid" >/dev/null 2>&1 || true
      return 1
    fi
  done
  wait "$info_pid"
}

if [[ "${OT_SKIP_DOCKER:-0}" == "1" ]]; then
  echo "platform-matrix-smoke: OT_SKIP_DOCKER=1 -> skip remote-docker-smoke"
elif docker_ready; then
  steps+=("remote-docker-smoke:./scripts/ci/remote-docker-smoke.sh")
else
  echo "platform-matrix-smoke: docker unavailable -> skip remote-docker-smoke"
fi

pass_count=0
results_json="[]"

for entry in "${steps[@]}"; do
  name="${entry%%:*}"
  cmd="${entry#*:}"
  echo "[platform-matrix-smoke] >>> $name"

  if bash -lc "cd '$ROOT_DIR' && $cmd"; then
    status="PASS"
    pass_count=$((pass_count + 1))
  else
    status="FAIL"
    node - <<'NODE' "$SUMMARY_PATH" "$results_json" "$name" "$status" "$pass_count"
const fs = require('node:fs');
const [summaryPath, existing, name, status, passCount] = process.argv.slice(2);
const parsed = JSON.parse(existing || '[]');
parsed.push({ name, status });
fs.writeFileSync(summaryPath, JSON.stringify({
  name: 'platform-matrix-smoke',
  status: 'FAIL',
  passCount: Number(passCount),
  total: parsed.length,
  steps: parsed,
  generatedAt: new Date().toISOString(),
}, null, 2), 'utf-8');
NODE
    echo "[platform-matrix-smoke] FAIL at step=$name summary=$SUMMARY_PATH" >&2
    exit 1
  fi

  results_json="$(node - <<'NODE' "$results_json" "$name" "$status"
const [existing, name, status] = process.argv.slice(2);
const parsed = JSON.parse(existing || '[]');
parsed.push({ name, status });
process.stdout.write(JSON.stringify(parsed));
NODE
)"
done

node - <<'NODE' "$SUMMARY_PATH" "$results_json" "$pass_count"
const fs = require('node:fs');
const [summaryPath, results, passCount] = process.argv.slice(2);
const parsed = JSON.parse(results || '[]');
fs.writeFileSync(summaryPath, JSON.stringify({
  name: 'platform-matrix-smoke',
  status: 'PASS',
  passCount: Number(passCount),
  total: parsed.length,
  steps: parsed,
  generatedAt: new Date().toISOString(),
}, null, 2), 'utf-8');
NODE

echo "[platform-matrix-smoke] PASS summary=$SUMMARY_PATH"

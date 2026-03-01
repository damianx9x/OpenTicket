#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_REPORT_DIR="$ROOT_DIR/Moj/testy/runtime/reports"
SYSTEM_REPORT_DIR="$ROOT_DIR/.runtime/reports"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT_DIR/docs/test-reports/full-regression-$STAMP"
OUT_REPORTS="$OUT_DIR/reports"

mkdir -p "$OUT_DIR" "$OUT_REPORTS" "$RUNTIME_REPORT_DIR" "$SYSTEM_REPORT_DIR"

echo "[full-regression] output: $OUT_DIR"

capture_new_runtime_reports() {
  local before="$1"
  local after="$2"
  comm -13 "$before" "$after" | while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    if [[ -f "$RUNTIME_REPORT_DIR/$rel" ]]; then
      cp "$RUNTIME_REPORT_DIR/$rel" "$OUT_REPORTS/$rel"
    fi
  done
}

capture_new_system_reports() {
  local before="$1"
  local after="$2"
  comm -13 "$before" "$after" | while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    if [[ -f "$SYSTEM_REPORT_DIR/$rel" ]]; then
      cp "$SYSTEM_REPORT_DIR/$rel" "$OUT_REPORTS/$rel"
    fi
  done
}

run_step() {
  local id="$1"
  shift
  local before_runtime before_system after_runtime after_system
  before_runtime="$(mktemp "${TMPDIR:-/tmp}/ot-before-runtime.XXXXXX")"
  before_system="$(mktemp "${TMPDIR:-/tmp}/ot-before-system.XXXXXX")"
  after_runtime="$(mktemp "${TMPDIR:-/tmp}/ot-after-runtime.XXXXXX")"
  after_system="$(mktemp "${TMPDIR:-/tmp}/ot-after-system.XXXXXX")"
  trap 'rm -f "$before_runtime" "$before_system" "$after_runtime" "$after_system"' RETURN

  ls -1 "$RUNTIME_REPORT_DIR" 2>/dev/null | sort > "$before_runtime" || true
  ls -1 "$SYSTEM_REPORT_DIR" 2>/dev/null | sort > "$before_system" || true

  echo "[full-regression] >>> $id"
  set +e
  "$@" 2>&1 | tee "$OUT_DIR/${id}.log"
  local code=${PIPESTATUS[0]}
  set -e

  ls -1 "$RUNTIME_REPORT_DIR" 2>/dev/null | sort > "$after_runtime" || true
  ls -1 "$SYSTEM_REPORT_DIR" 2>/dev/null | sort > "$after_system" || true
  capture_new_runtime_reports "$before_runtime" "$after_runtime"
  capture_new_system_reports "$before_system" "$after_system"

  if [[ $code -ne 0 ]]; then
    echo "[full-regression] FAIL at step: $id (exit=$code)"
    exit $code
  fi
  echo "[full-regression] PASS $id"
}

run_step "01-full-install-usage-smoke" "$ROOT_DIR/Moj/testy/full-install-usage-smoke.sh"
run_step "02-smoke" "$ROOT_DIR/Moj/testy/smoke.sh"
run_step "03-auth-smoke" "$ROOT_DIR/Moj/testy/auth-smoke.sh"
run_step "04-setup-import-smoke" "$ROOT_DIR/Moj/testy/setup-import-smoke.sh"
run_step "05-setup-state-regression-smoke" "$ROOT_DIR/Moj/testy/setup-state-regression-smoke.sh"
run_step "06-custom-path-backup-smoke" "$ROOT_DIR/Moj/testy/custom-path-backup-smoke.sh"
run_step "07-backup-ui-smoke" "$ROOT_DIR/Moj/testy/backup-ui-smoke.sh"
run_step "08-backup-verify-smoke" "$ROOT_DIR/Moj/testy/backup-verify-smoke.sh"
run_step "09-auto-backup-smoke" "$ROOT_DIR/Moj/testy/auto-backup-smoke.sh"
run_step "10-profile-ui-smoke" "$ROOT_DIR/Moj/testy/profile-ui-smoke.sh"
run_step "11-client-connect-installed-server" "$ROOT_DIR/Moj/testy/client-connect-installed-server.sh"
run_step "12-ui-random-10-all-browsers" "$ROOT_DIR/Moj/testy/ui-random-10.sh" --all-browsers
run_step "13-print-report-smoke" "$ROOT_DIR/Moj/testy/print-report-smoke.sh"
run_step "14-security-check" "$ROOT_DIR/scripts/security-check.sh"
run_step "15-dependency-deep-check" "$ROOT_DIR/scripts/dependency-deep-check.sh"
run_step "16-fresh-10x-smoke" "$ROOT_DIR/Moj/testy/fresh-10x-smoke.sh"

SUMMARY_MD="$OUT_DIR/SUMMARY.md"
{
  echo "# Full Regression Suite"
  echo
  echo "- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- Scope: install/setup/demo/theme/logo/filter/backup/auth/random-ui/security/dependencies"
  echo "- Status: PASS"
  echo
  echo "## Logs"
  echo
  for f in "$OUT_DIR"/*.log; do
    bn="$(basename "$f")"
    echo "- \`$bn\`"
  done
  echo
  echo "## Reports"
  echo
  for f in "$OUT_REPORTS"/*; do
    bn="$(basename "$f")"
    echo "- \`$bn\`"
  done
} > "$SUMMARY_MD"

echo "[full-regression] DONE summary=$SUMMARY_MD"

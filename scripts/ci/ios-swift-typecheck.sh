#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT_DIR="$ROOT_DIR/.runtime/reports"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_PATH="$REPORT_DIR/ios-swift-typecheck-$STAMP.json"
LOG_PATH="$REPORT_DIR/ios-swift-typecheck-$STAMP.log"
TARGET="${IOS_SWIFT_TARGET:-arm64-apple-ios17.0-simulator}"

mkdir -p "$REPORT_DIR"

status="PASS"
message="SwiftUI typecheck passed"
skipped="false"

if [[ "$(uname -s)" != "Darwin" ]]; then
  status="SKIP"
  message="ios-swift-typecheck: skipped (requires macOS + Xcode)"
  skipped="true"
else
  if ! command -v xcrun >/dev/null 2>&1; then
    status="FAIL"
    message="xcrun not found (Xcode command-line tools missing)"
  else
    SDK_PATH="$(xcrun --sdk iphonesimulator --show-sdk-path 2>/dev/null || true)"
    if [[ -z "$SDK_PATH" || ! -d "$SDK_PATH" ]]; then
      status="FAIL"
      message="Could not resolve iPhoneSimulator SDK path"
    else
      set +e
      xcrun swiftc -typecheck \
        -sdk "$SDK_PATH" \
        -target "$TARGET" \
        "$ROOT_DIR"/ios/SwiftUI/*.swift >"$LOG_PATH" 2>&1
      TYPECHECK_EXIT=$?
      set -e

      if [[ "$TYPECHECK_EXIT" -ne 0 ]]; then
        status="FAIL"
        message="SwiftUI typecheck failed (see log)"
      fi
    fi
  fi
fi

node - <<'NODE' "$REPORT_PATH" "$LOG_PATH" "$TARGET" "$status" "$message" "$skipped"
const fs = require('node:fs');
const [reportPath, logPath, target, status, message, skipped] = process.argv.slice(2);
const payload = {
  name: 'ios-swift-typecheck',
  status,
  message,
  skipped: skipped === 'true',
  target,
  logPath,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2), 'utf-8');
NODE

if [[ "$status" == "FAIL" ]]; then
  echo "ios-swift-typecheck: FAIL report=$REPORT_PATH" >&2
  if [[ -f "$LOG_PATH" ]]; then
    echo "--- ios-swift-typecheck log tail ---" >&2
    tail -n 80 "$LOG_PATH" >&2 || true
    echo "--- end log tail ---" >&2
  fi
  exit 1
fi

echo "ios-swift-typecheck: $status report=$REPORT_PATH"

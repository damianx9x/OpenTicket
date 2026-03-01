#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"$ROOT_DIR/Moj/testy/setup-import-smoke.sh"
"$ROOT_DIR/Moj/testy/backup-verify-smoke.sh"

echo "[disaster-restore-live] PASS"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$ROOT_DIR/Moj/testy/start.sh" --fresh --no-open
node "$ROOT_DIR/Moj/testy/capture-release-screenshots.mjs"

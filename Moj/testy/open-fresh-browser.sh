#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$ROOT_DIR/Moj/testy/runtime"
ENV_FILE="$TEST_ROOT/env"
PROFILE_DIR="$TEST_ROOT/browser-profile"

PORT="3200"
RESET_PROFILE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset-profile)
      RESET_PROFILE=1
      shift
      ;;
    --port)
      PORT="${2:-3200}"
      shift 2
      ;;
    *)
      echo "[Moj/testy] Nieznany argument: $1"
      echo "[Moj/testy] Użycie: ./Moj/testy/open-fresh-browser.sh [--reset-profile] [--port 3200]"
      exit 2
      ;;
  esac
done

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if [[ "$RESET_PROFILE" == "1" ]]; then
  rm -rf "$PROFILE_DIR"
fi
mkdir -p "$PROFILE_DIR"

URL="http://127.0.0.1:${PORT}"

if [[ -d "/Applications/Google Chrome.app" ]]; then
  open -na "Google Chrome" --args \
    "--user-data-dir=$PROFILE_DIR" \
    --no-first-run \
    --no-default-browser-check \
    --disk-cache-size=1 \
    "$URL"
  echo "[Moj/testy] Otworzono Chrome w świeżym profilu: $PROFILE_DIR"
  exit 0
fi

echo "[Moj/testy] Chrome nie znaleziony. Otwieram domyślną przeglądarkę (bez izolowanego profilu)."
open "$URL"

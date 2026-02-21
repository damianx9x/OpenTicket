#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:3200}"

BROWSERS="chromium"
FORCE_FRESH=0
if [[ "${1:-}" == "--all-browsers" ]]; then
  BROWSERS="chromium webkit"
fi

for arg in "$@"; do
  case "$arg" in
    --all-browsers)
      ;;
    --fresh)
      FORCE_FRESH=1
      ;;
    *)
      echo "[Moj/testy] Nieznany argument: $arg"
      echo "[Moj/testy] Użycie: ./Moj/testy/ui-random-10.sh [--all-browsers] [--fresh]"
      exit 2
      ;;
  esac
done

ensure_runtime_ready() {
  local needs_fresh=0

  if [[ "$FORCE_FRESH" == "1" ]]; then
    needs_fresh=1
  elif ! curl -fsS "$BASE_URL/api/v1/health" >/dev/null 2>&1; then
    needs_fresh=1
  else
    local status_json mode
    status_json="$(curl -fsS -X POST "$BASE_URL/api/v1/setup/status" 2>/dev/null || true)"
    mode="$(node -e 'const raw=process.argv[1]||"{}";let x={};try{x=JSON.parse(raw);}catch{};const s=(x&&x.data)?x.data:x;process.stdout.write(((s&&s.installationMode)||"").toString())' "$status_json")"
    if [[ "$mode" == "client_only" ]]; then
      needs_fresh=1
    fi
  fi

  if [[ "$needs_fresh" == "1" ]]; then
    echo "[Moj/testy] runtime not ready for random UI -> start fresh server_client"
    "$ROOT_DIR/Moj/testy/start.sh" --fresh --no-open
  fi
}

ensure_runtime_ready

for B in $BROWSERS; do
  echo "[Moj/testy] running random UI actions on $B"
  node "$ROOT_DIR/Moj/testy/ui-random-10.mjs" --browser "$B" --base-url "$BASE_URL"
done

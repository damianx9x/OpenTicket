#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PORT="${PORT:-3200}"
FRESH_FLAG="${FRESH_FLAG-__UNSET__}"
START_ARGS=("--no-open")
if [[ "$FRESH_FLAG" == "__UNSET__" ]]; then
  START_ARGS=("--fresh" "${START_ARGS[@]}")
elif [[ -n "$FRESH_FLAG" ]]; then
  START_ARGS=("$FRESH_FLAG" "${START_ARGS[@]}")
fi

detect_lan_ip() {
  local ip=""
  for nic in en0 en1 bridge100; do
    ip="$(ipconfig getifaddr "$nic" 2>/dev/null || true)"
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return 0
    fi
  done
  ip="$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}')"
  if [[ -n "$ip" ]]; then
    echo "$ip"
    return 0
  fi
  return 1
}

echo "[Moj/testy][ios] Uruchamiam backend w trybie LAN dla testów iPhone..."
BACKEND_BIND_HOST=0.0.0.0 \
ALLOW_PRIVATE_LAN_CORS=1 \
PORT="$PORT" \
"$ROOT_DIR/Moj/testy/start.sh" "${START_ARGS[@]}"

LAN_IP="$(detect_lan_ip || true)"
if [[ -z "$LAN_IP" ]]; then
  echo "[Moj/testy][ios] Nie wykryto automatycznie adresu LAN. Sprawdź ręcznie `ifconfig`."
  exit 0
fi

echo
echo "[Moj/testy][ios] Backend gotowy do testów na iPhone."
echo "[Moj/testy][ios] WebUI (Mac): http://127.0.0.1:${PORT}"
echo "[Moj/testy][ios] API (iPhone): http://${LAN_IP}:${PORT}"
echo "[Moj/testy][ios] Setup (iPhone): http://${LAN_IP}:${PORT}/setup"
echo
echo "[Moj/testy][ios] Następny krok w iOS app:"
echo "  - wprowadź API base: http://${LAN_IP}:${PORT}"

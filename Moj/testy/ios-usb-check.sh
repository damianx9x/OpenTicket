#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3200}"
FRESH_FLAG="${FRESH_FLAG-__UNSET__}"

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
  [[ -n "$ip" ]] && echo "$ip"
}

START_ARGS=("--no-open")
if [[ "$FRESH_FLAG" == "__UNSET__" ]]; then
  START_ARGS=("--fresh" "${START_ARGS[@]}")
elif [[ -n "$FRESH_FLAG" ]]; then
  START_ARGS=("$FRESH_FLAG" "${START_ARGS[@]}")
fi

echo "[ios-usb-check] Start środowiska testowego (LAN + CORS)..."
BACKEND_BIND_HOST=0.0.0.0 \
ALLOW_PRIVATE_LAN_CORS=1 \
PORT="$PORT" \
"$ROOT_DIR/Moj/testy/start.sh" "${START_ARGS[@]}"

LAN_IP="$(detect_lan_ip || true)"
if [[ -z "$LAN_IP" ]]; then
  echo "[ios-usb-check] Nie wykryto adresu LAN."
  exit 1
fi

echo "[ios-usb-check] Healthcheck..."
curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null

echo "[ios-usb-check] Setup status..."
curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/setup/status" >/dev/null

echo
echo "[ios-usb-check] OK"
echo "[ios-usb-check] WebUI (Mac):  http://127.0.0.1:${PORT}"
echo "[ios-usb-check] API (iPhone): http://${LAN_IP}:${PORT}"
echo "[ios-usb-check] Setup iPhone: http://${LAN_IP}:${PORT}/setup"
echo "[ios-usb-check] W iOS wpisz API base: http://${LAN_IP}:${PORT}"

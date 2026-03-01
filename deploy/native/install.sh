#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SOURCE_DIR="$REPO_ROOT"
APP_DIR="/opt/openticket/app"
DATA_DIR="/var/lib/openticket/data"
CONFIG_DIR="/var/lib/openticket/config"
LOG_DIR="/var/log/openticket"
ENV_DIR="/etc/openticket"
SERVICE_FILE="/etc/systemd/system/openticket.service"
PORT="3200"
DRY_RUN=0

usage() {
  cat <<USAGE
Usage: sudo ./deploy/native/install.sh [--source <repo-dir>] [--port <port>]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_DIR="${2:-$SOURCE_DIR}"
      shift 2
      ;;
    --port)
      PORT="${2:-3200}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$DRY_RUN" -eq 0 && "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required for native install." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required for native install." >&2
  exit 1
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  [[ -f "$SOURCE_DIR/backend/package.json" ]]
  [[ -f "$SOURCE_DIR/frontend/package.json" ]]
  [[ -f "$SCRIPT_DIR/openticket.service" ]]
  [[ -f "$SCRIPT_DIR/openticket.env" ]]
  echo "native-install dry-run: PASS (source=$SOURCE_DIR port=$PORT)"
  exit 0
fi

if ! id openticket >/dev/null 2>&1; then
  useradd --system --home /var/lib/openticket --shell /usr/sbin/nologin openticket
fi

mkdir -p "$APP_DIR" "$DATA_DIR" "$CONFIG_DIR" "$LOG_DIR" "$ENV_DIR"
chown -R openticket:openticket /var/lib/openticket "$LOG_DIR"

pushd "$SOURCE_DIR/backend" >/dev/null
npm ci
npm run build
popd >/dev/null

pushd "$SOURCE_DIR/frontend" >/dev/null
npm ci
npm run build
popd >/dev/null

rm -rf "$APP_DIR/backend" "$APP_DIR/frontend"
mkdir -p "$APP_DIR/backend" "$APP_DIR/frontend"

rsync -a --delete "$SOURCE_DIR/backend/dist" "$APP_DIR/backend/"
rsync -a --delete "$SOURCE_DIR/backend/prisma" "$APP_DIR/backend/"
rsync -a --delete "$SOURCE_DIR/backend/node_modules" "$APP_DIR/backend/"
cp "$SOURCE_DIR/backend/package.json" "$APP_DIR/backend/package.json"

rsync -a --delete "$SOURCE_DIR/frontend/out" "$APP_DIR/frontend/"

cp "$SCRIPT_DIR/openticket.service" "$SERVICE_FILE"
if [[ ! -f "$ENV_DIR/openticket.env" ]]; then
  cp "$SCRIPT_DIR/openticket.env" "$ENV_DIR/openticket.env"
fi

sed -i "s/^PORT=.*/PORT=${PORT}/" "$ENV_DIR/openticket.env"

chown -R openticket:openticket "$APP_DIR"
chmod 640 "$ENV_DIR/openticket.env"

systemctl daemon-reload
systemctl enable --now openticket

for n in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

TOKEN_RESPONSE="$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/setup/token/create" -H 'content-type: application/json' -d '{"ttlMinutes":15,"maxAttempts":5}')"
SETUP_TOKEN="$(printf '%s' "$TOKEN_RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);process.stdout.write(o?.data?.token||o?.token||'');}catch{}})")"

cat <<INFO
OpenTicket native install complete.
- API URL: http://127.0.0.1:${PORT}
- setup token: ${SETUP_TOKEN:-<unavailable>}
- service: systemctl status openticket
INFO

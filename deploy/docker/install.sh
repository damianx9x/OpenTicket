#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/compose.sqlite.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
WITH_TLS=0

usage() {
  cat <<USAGE
OpenTicket remote install (Docker)

Usage:
  ./deploy/docker/install.sh [--with-tls] [--domain <fqdn>] [--port <port>] [--image <name:tag>]

Options:
  --with-tls       start Caddy reverse proxy profile
  --domain         domain for TLS (required with --with-tls)
  --port           host port for OpenTicket backend (default 3200)
  --image          docker image name (default ghcr.io/damianx9x/openticket:latest)
USAGE
}

DOMAIN=""
PORT="3200"
IMAGE="ghcr.io/damianx9x/openticket:latest"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-tls)
      WITH_TLS=1
      shift
      ;;
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-3200}"
      shift 2
      ;;
    --image)
      IMAGE="${2:-$IMAGE}"
      shift 2
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

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required (docker compose)." >&2
  exit 1
fi

if [[ "$WITH_TLS" -eq 1 && -z "$DOMAIN" ]]; then
  echo "--domain is required with --with-tls" >&2
  exit 1
fi

cat > "$ENV_FILE" <<ENV
OPENTICKET_PORT=${PORT}
OPENTICKET_IMAGE=${IMAGE}
OPENTICKET_DOMAIN=${DOMAIN}
ENV

pushd "$SCRIPT_DIR" >/dev/null
if [[ "$WITH_TLS" -eq 1 ]]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile tls up -d --build
else
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build
fi
popd >/dev/null

"${SCRIPT_DIR}/healthcheck.sh" 127.0.0.1 "$PORT"

TOKEN_RESPONSE="$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/setup/token/create" -H 'content-type: application/json' -d '{"ttlMinutes":15,"maxAttempts":5}')"
SETUP_TOKEN="$(printf '%s' "$TOKEN_RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);process.stdout.write(o?.data?.token||o?.token||'');}catch{}})")"
EXPIRES_AT="$(printf '%s' "$TOKEN_RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);process.stdout.write(o?.data?.expiresAt||o?.expiresAt||'');}catch{}})")"

cat <<INFO

OpenTicket server started.
- API URL: http://127.0.0.1:${PORT}
- Setup token: ${SETUP_TOKEN:-<unavailable>}
- Token expires at: ${EXPIRES_AT:-<unknown>}

Next step:
1) Open desktop/web setup wizard
2) Choose: Serwer + klient -> Host zdalny
3) Enter API URL + setup token
INFO

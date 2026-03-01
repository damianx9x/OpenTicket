#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/docker/compose.sqlite.yml"
PORT="${OT_REMOTE_SMOKE_PORT:-3320}"
export OPENTICKET_PORT="$PORT"
export OPENTICKET_IMAGE="openticket-ci:latest"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

docker compose -f "$COMPOSE_FILE" up -d --build
"$ROOT_DIR/deploy/docker/healthcheck.sh" 127.0.0.1 "$PORT"

TOKEN_JSON="$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/setup/token/create" -H 'content-type: application/json' -d '{"ttlMinutes":15,"maxAttempts":5}')"
SETUP_TOKEN="$(printf '%s' "$TOKEN_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);const x=o.data||o;process.stdout.write(x.token||'');})")"
if [[ -z "$SETUP_TOKEN" ]]; then
  echo "Missing setup token in response" >&2
  exit 1
fi

CLAIM_JSON="$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/setup/token/claim" -H 'content-type: application/json' -d "{\"token\":\"${SETUP_TOKEN}\"}")"
SESSION_TOKEN="$(printf '%s' "$CLAIM_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);const x=o.data||o;process.stdout.write(x.setupSessionToken||'');})")"
if [[ -z "$SESSION_TOKEN" ]]; then
  echo "Missing setup session token in response" >&2
  exit 1
fi

curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/setup/validate-path" \
  -H "content-type: application/json" \
  -H "x-setup-session-token: ${SESSION_TOKEN}" \
  -d '{"dataPath":"/var/lib/openticket/data"}' >/dev/null

curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/setup/token/revoke" \
  -H "content-type: application/json" \
  -H "x-setup-session-token: ${SESSION_TOKEN}" \
  -d '{}' >/dev/null

echo "remote-docker-smoke: PASS"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/compose.sqlite.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
PURGE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --purge)
      PURGE=1
      shift
      ;;
    -h|--help)
      echo "Usage: ./deploy/docker/uninstall.sh [--purge]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

pushd "$SCRIPT_DIR" >/dev/null
if [[ "$PURGE" -eq 1 ]]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down -v --remove-orphans || true
else
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down --remove-orphans || true
fi
popd >/dev/null

echo "OpenTicket docker stack removed."
if [[ "$PURGE" -eq 1 ]]; then
  echo "Volumes deleted (--purge)."
else
  echo "Data volumes preserved. Use --purge for full cleanup."
fi

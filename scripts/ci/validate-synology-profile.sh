#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/docker/compose.sqlite.yml"
DOC_FILE="$ROOT_DIR/docs/REMOTE_INSTALL_SYNOLOGY.md"

[[ -f "$COMPOSE_FILE" ]]
[[ -f "$DOC_FILE" ]]

grep -q "synology_docker" "$ROOT_DIR/backend/src/config/config.types.ts"
grep -q "profiles: \['tls'\]" "$COMPOSE_FILE"
grep -q "OPENTICKET_DOMAIN" "$COMPOSE_FILE"
grep -q "Synology" "$DOC_FILE"

echo "synology-profile-validate: PASS"

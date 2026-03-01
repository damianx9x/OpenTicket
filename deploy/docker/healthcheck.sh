#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-127.0.0.1}"
PORT="${2:-3200}"
BASE="http://${HOST}:${PORT}"

if ! curl -fsS "${BASE}/api/v1/health" >/dev/null; then
  echo "[healthcheck] FAIL: /api/v1/health unreachable (${BASE})" >&2
  exit 1
fi

if ! curl -fsS -X POST "${BASE}/api/v1/setup/status" >/dev/null; then
  echo "[healthcheck] FAIL: /api/v1/setup/status unreachable (${BASE})" >&2
  exit 1
fi

echo "[healthcheck] OK ${BASE}"

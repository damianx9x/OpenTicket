#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
README_PATH="${1:-$ROOT_DIR/README.md}"
PKG_NAME="${PKG_NAME:-OpenTicket-Installer.pkg}"
EXE_NAME="${EXE_NAME:-OpenTicket-Installer.exe}"

if [[ ! -f "$README_PATH" ]]; then
  echo "[update-readme-installer-link] Brak pliku README: $README_PATH" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[update-readme-installer-link] Wymagane polecenie: node" >&2
  exit 1
fi

VERSION="$(node -p "require('$ROOT_DIR/desktop/package.json').version")"
ORIGIN_URL="$(git -C "$ROOT_DIR" config --get remote.origin.url || true)"

if [[ "${RELEASE_REPO_URL:-}" != "" ]]; then
  REPO_URL="${RELEASE_REPO_URL%/}"
elif [[ "$ORIGIN_URL" =~ ^git@github\.com:(.+)\.git$ ]]; then
  REPO_URL="https://github.com/${BASH_REMATCH[1]}"
elif [[ "$ORIGIN_URL" =~ ^https://github\.com/(.+)\.git$ ]]; then
  REPO_URL="https://github.com/${BASH_REMATCH[1]}"
elif [[ "$ORIGIN_URL" =~ ^https://github\.com/(.+)$ ]]; then
  REPO_URL="https://github.com/${BASH_REMATCH[1]}"
else
  REPO_URL="https://github.com/damianx9x/OpenTicket"
fi

PKG_LATEST_URL="${REPO_URL}/releases/latest/download/${PKG_NAME}"
PKG_VERSION_URL="${REPO_URL}/releases/download/v${VERSION}/${PKG_NAME}"
EXE_LATEST_URL="${REPO_URL}/releases/latest/download/${EXE_NAME}"
EXE_VERSION_URL="${REPO_URL}/releases/download/v${VERSION}/${EXE_NAME}"

BLOCK="$(cat <<EOF
<!-- INSTALLER_LINK:START -->
## Installers (macOS + Windows)
- macOS PKG (latest): [${PKG_NAME}](${PKG_LATEST_URL})
- macOS PKG (v${VERSION}): [${PKG_NAME}](${PKG_VERSION_URL})
- Windows EXE (latest): [${EXE_NAME}](${EXE_LATEST_URL})
- Windows EXE (v${VERSION}): [${EXE_NAME}](${EXE_VERSION_URL})
<!-- INSTALLER_LINK:END -->
EOF
)"

TMP_FILE="$(mktemp "${TMPDIR:-/tmp}/readme-installer.XXXXXX")"
trap 'rm -f "$TMP_FILE"' EXIT

if grep -q "<!-- INSTALLER_LINK:START -->" "$README_PATH"; then
  START_LINE="$(grep -n "<!-- INSTALLER_LINK:START -->" "$README_PATH" | head -n1 | cut -d: -f1)"
  END_LINE="$(grep -n "<!-- INSTALLER_LINK:END -->" "$README_PATH" | head -n1 | cut -d: -f1)"
  if [[ -z "$START_LINE" || -z "$END_LINE" || "$END_LINE" -lt "$START_LINE" ]]; then
    echo "[update-readme-installer-link] Nieprawidłowe markery INSTALLER_LINK w README." >&2
    exit 1
  fi

  if [[ "$START_LINE" -gt 1 ]]; then
    head -n $((START_LINE - 1)) "$README_PATH" >"$TMP_FILE"
  else
    : >"$TMP_FILE"
  fi
  printf '%s\n' "$BLOCK" >>"$TMP_FILE"
  tail -n +$((END_LINE + 1)) "$README_PATH" >>"$TMP_FILE"
else
  head -n 1 "$README_PATH" >"$TMP_FILE"
  printf '\n%s\n' "$BLOCK" >>"$TMP_FILE"
  tail -n +2 "$README_PATH" >>"$TMP_FILE"
fi

mv "$TMP_FILE" "$README_PATH"
echo "[update-readme-installer-link] README updated: $README_PATH"

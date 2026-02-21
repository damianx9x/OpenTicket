#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOJ_DIR="$ROOT_DIR/Moj"
RELEASE_DIR="${RELEASE_DIR:-$ROOT_DIR/desktop/release-win}"
EXE_OUT="$MOJ_DIR/OpenTicket-Installer.exe"
PORTABLE_OUT="$MOJ_DIR/OpenTicket-Portable.exe"
README_LINK_UPDATER="$ROOT_DIR/scripts/update-readme-installer-link.sh"

mkdir -p "$MOJ_DIR"

log() {
  echo "[Moj/build-win] $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Brak wymaganej komendy: $cmd"
    exit 1
  fi
}

require_cmd node
require_cmd npm

cd "$ROOT_DIR"

log "Czyszczenie poprzednich artefaktów Windows"
rm -f "$EXE_OUT" "$PORTABLE_OUT" "$MOJ_DIR"/OpenTicket-Installer.exe.sha256 "$MOJ_DIR"/OpenTicket-Portable.exe.sha256
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

log "Budowa backend"
npm --prefix backend run build

log "Budowa frontend"
npm --prefix frontend run build

log "Budowa desktop main"
npm --prefix desktop run build:electron

log "Budowa artefaktów Windows (.exe)"
(
  cd "$ROOT_DIR/desktop"
  npx electron-builder --win --x64 --publish never --config.directories.output="$RELEASE_DIR"
)

VERSION="$(node -p "require('./desktop/package.json').version")"
SETUP_SRC="$RELEASE_DIR/OpenTicket Setup ${VERSION}.exe"
PORTABLE_SRC="$RELEASE_DIR/OpenTicket ${VERSION}.exe"

if [[ ! -f "$SETUP_SRC" ]]; then
  echo "Brak pliku instalatora: $SETUP_SRC"
  ls -la "$RELEASE_DIR"
  exit 1
fi

cp "$SETUP_SRC" "$EXE_OUT"
if [[ -f "$PORTABLE_SRC" ]]; then
  cp "$PORTABLE_SRC" "$PORTABLE_OUT"
fi

(
  cd "$MOJ_DIR"
  shasum -a 256 "$(basename "$EXE_OUT")" > "OpenTicket-Installer.exe.sha256"
  if [[ -f "$PORTABLE_OUT" ]]; then
    shasum -a 256 "$(basename "$PORTABLE_OUT")" > "OpenTicket-Portable.exe.sha256"
  fi
)

if [[ -x "$README_LINK_UPDATER" ]]; then
  PKG_NAME="OpenTicket-Installer.pkg" EXE_NAME="$(basename "$EXE_OUT")" "$README_LINK_UPDATER"
fi

log "Gotowe artefakty Windows:"
ls -lh "$MOJ_DIR" | awk '{print "[Moj/build-win] " $0}'

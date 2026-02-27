#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOJ_DIR="$ROOT_DIR/Moj"
RELEASE_DIR="${RELEASE_DIR:-$ROOT_DIR/desktop/release-win}"
ORIGINAL_RELEASE_DIR="$RELEASE_DIR"
EXE_OUT="$MOJ_DIR/OpenTicket-Installer.exe"
PORTABLE_OUT="$MOJ_DIR/OpenTicket-Portable.exe"
README_LINK_UPDATER="$ROOT_DIR/scripts/update-readme-installer-link.sh"

mkdir -p "$MOJ_DIR"

log() {
  echo "[Moj/build-win] $*"
}

prepare_release_dir() {
  if [[ -e "$RELEASE_DIR" ]] && ! rm -rf "$RELEASE_DIR" 2>/dev/null; then
    local fallback="$ROOT_DIR/desktop/release-win-$(date +%Y%m%d-%H%M%S)"
    log "UWAGA: brak uprawnień do czyszczenia $RELEASE_DIR. Używam fallback: $fallback"
    RELEASE_DIR="$fallback"
  fi
  rm -rf "$RELEASE_DIR"
  mkdir -p "$RELEASE_DIR"
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
rm -f "$MOJ_DIR"/latest.yml "$MOJ_DIR"/OpenTicket-Setup-*.exe "$MOJ_DIR"/OpenTicket-Setup-*.exe.blockmap \
  "$MOJ_DIR"/OpenTicket-Portable-*.exe "$MOJ_DIR"/OpenTicket-Portable-*.exe.blockmap
prepare_release_dir

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
WIN_UPDATE_YML="$RELEASE_DIR/latest.yml"

if [[ -f "$WIN_UPDATE_YML" ]]; then
  WIN_SETUP_REL="$(awk '/^path:[[:space:]]*/ {print $2}' "$WIN_UPDATE_YML" | tr -d '"' | head -n1)"
  if [[ -n "$WIN_SETUP_REL" && -f "$RELEASE_DIR/$WIN_SETUP_REL" ]]; then
    SETUP_SRC="$RELEASE_DIR/$WIN_SETUP_REL"
  fi
  if [[ -n "$WIN_SETUP_REL" && ! -f "$RELEASE_DIR/$WIN_SETUP_REL" && -f "$SETUP_SRC" ]]; then
    cp "$SETUP_SRC" "$RELEASE_DIR/$WIN_SETUP_REL"
    if [[ -f "${SETUP_SRC}.blockmap" ]]; then
      cp "${SETUP_SRC}.blockmap" "$RELEASE_DIR/$WIN_SETUP_REL.blockmap"
    fi
    SETUP_SRC="$RELEASE_DIR/$WIN_SETUP_REL"
  fi
fi

if [[ ! -f "$PORTABLE_SRC" ]]; then
  PORTABLE_ALT="$(find "$RELEASE_DIR" -maxdepth 1 -type f -name 'OpenTicket-Portable-*.exe' | head -n1 || true)"
  if [[ -n "$PORTABLE_ALT" ]]; then
    PORTABLE_SRC="$PORTABLE_ALT"
  fi
fi

if [[ ! -f "$SETUP_SRC" ]]; then
  echo "Brak pliku instalatora: $SETUP_SRC"
  ls -la "$RELEASE_DIR"
  exit 1
fi

cp "$SETUP_SRC" "$EXE_OUT"
if [[ -f "$PORTABLE_SRC" ]]; then
  cp "$PORTABLE_SRC" "$PORTABLE_OUT"
fi

log "Kopiowanie artefaktów auto-update Windows (latest.yml + pliki wskazane)"
if [[ -f "$WIN_UPDATE_YML" ]]; then
  cp "$WIN_UPDATE_YML" "$MOJ_DIR/latest.yml"
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    if [[ -f "$RELEASE_DIR/$rel" ]]; then
      cp "$RELEASE_DIR/$rel" "$MOJ_DIR/$rel"
    fi
    if [[ -f "$RELEASE_DIR/$rel.blockmap" ]]; then
      cp "$RELEASE_DIR/$rel.blockmap" "$MOJ_DIR/$rel.blockmap"
    fi
  done < <(
    awk '
      /^path:[[:space:]]*/ { print $2 }
      /^[[:space:]]*-[[:space:]]*url:[[:space:]]*/ { print $3 }
    ' "$WIN_UPDATE_YML" | tr -d '"' | sort -u
  )
else
  log "UWAGA: brak $WIN_UPDATE_YML (auto-update Windows może nie działać)"
fi

(
  cd "$MOJ_DIR"
  shasum -a 256 "$(basename "$EXE_OUT")" > "OpenTicket-Installer.exe.sha256"
  if [[ -f "$PORTABLE_OUT" ]]; then
    shasum -a 256 "$(basename "$PORTABLE_OUT")" > "OpenTicket-Portable.exe.sha256"
  fi
  if [[ -f "latest.yml" ]]; then
    shasum -a 256 "latest.yml" > "latest.yml.sha256"
  fi
  for f in OpenTicket-Setup-*.exe OpenTicket-Setup-*.exe.blockmap OpenTicket-Portable-*.exe OpenTicket-Portable-*.exe.blockmap; do
    if [[ -f "$f" ]]; then
      shasum -a 256 "$f" > "$f.sha256"
    fi
  done
)

if [[ -x "$README_LINK_UPDATER" ]]; then
  PKG_NAME="OpenTicket-Installer.pkg" EXE_NAME="$(basename "$EXE_OUT")" "$README_LINK_UPDATER"
fi

log "Gotowe artefakty Windows:"
ls -lh "$MOJ_DIR" | awk '{print "[Moj/build-win] " $0}'
if [[ "$RELEASE_DIR" != "$ORIGINAL_RELEASE_DIR" ]]; then
  log "INFO: build output utworzony w fallback katalogu: $RELEASE_DIR"
fi

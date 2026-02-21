#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOJ_DIR="$ROOT_DIR/Moj"
RELEASE_DIR="$ROOT_DIR/desktop/release"
PKG_OUT="$MOJ_DIR/OpenTicket-Installer.pkg"
DMG_OUT="$MOJ_DIR/OpenTicket-Installer.dmg"
ZIP_OUT="$MOJ_DIR/OpenTicket-Installer.zip"
UNINSTALLER_SOURCE="$ROOT_DIR/scripts/uninstall-ticket-system.sh"
README_LINK_UPDATER="$ROOT_DIR/scripts/update-readme-installer-link.sh"

mkdir -p "$MOJ_DIR" "$ROOT_DIR/.runtime/logs"

log() {
  echo "[Moj/build] $*"
}

find_app_bundle() {
  local app
  app="$(find "$RELEASE_DIR" -maxdepth 3 -type d -name 'OpenTicket.app' | head -n 1 || true)"
  if [[ -z "$app" ]]; then
    return 1
  fi
  echo "$app"
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
require_cmd pkgbuild

cd "$ROOT_DIR"

log "Czyszczenie poprzednich artefaktów"
rm -f "$PKG_OUT" "$DMG_OUT" "$ZIP_OUT" "$MOJ_DIR"/*.sha256

log "Budowa backend"
npm --prefix backend run build

log "Budowa frontend"
npm --prefix frontend run build

log "Budowa desktop main"
npm --prefix desktop run build:electron

log "Budowa artefaktów macOS (.dmg/.zip + .app)"
npm --prefix desktop run dist:mac

APP_BUNDLE="$(find_app_bundle || true)"
if [[ -z "$APP_BUNDLE" ]]; then
  echo "Nie znaleziono OpenTicket.app po buildzie. Sprawdź $RELEASE_DIR"
  exit 1
fi

if [[ ! -f "$UNINSTALLER_SOURCE" ]]; then
  echo "Brak skryptu deinstalatora: $UNINSTALLER_SOURCE"
  exit 1
fi

log "Tworzenie instalatora .pkg z kompletnym deinstalatorem"
xattr -cr "$APP_BUNDLE" 2>/dev/null || true
PKG_STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/openticket-pkg-root.XXXXXX")"
trap 'rm -rf "$PKG_STAGE_ROOT"' EXIT

mkdir -p "$PKG_STAGE_ROOT/Applications"
mkdir -p "$PKG_STAGE_ROOT/Library/Application Support/OpenTicket"

export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1

ditto --norsrc --noextattr "$APP_BUNDLE" "$PKG_STAGE_ROOT/Applications/OpenTicket.app"
cp -f "$UNINSTALLER_SOURCE" "$PKG_STAGE_ROOT/Library/Application Support/OpenTicket/uninstall-openticket.sh"
chmod 755 "$PKG_STAGE_ROOT/Library/Application Support/OpenTicket/uninstall-openticket.sh"

cat > "$PKG_STAGE_ROOT/Applications/Odinstaluj OpenTicket.command" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

UNINSTALLER="/Library/Application Support/OpenTicket/uninstall-openticket.sh"
if [[ ! -x "$UNINSTALLER" ]]; then
  echo "Brak deinstalatora: $UNINSTALLER"
  echo "Spróbuj ponownej instalacji OpenTicket."
  exit 1
fi

exec "$UNINSTALLER"
EOF
chmod 755 "$PKG_STAGE_ROOT/Applications/Odinstaluj OpenTicket.command"

cat > "$PKG_STAGE_ROOT/Applications/Uninstall OpenTicket.command" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exec "/Applications/Odinstaluj OpenTicket.command"
EOF
chmod 755 "$PKG_STAGE_ROOT/Applications/Uninstall OpenTicket.command"

# Defensively remove AppleDouble/resource-fork leftovers from staged payload.
find "$PKG_STAGE_ROOT" -name '._*' -type f -delete 2>/dev/null || true
xattr -rc "$PKG_STAGE_ROOT" 2>/dev/null || true

PKG_VERSION="$(node -p "require('./desktop/package.json').version")"

COPYFILE_DISABLE=1 COPY_EXTENDED_ATTRIBUTES_DISABLE=1 pkgbuild \
  --root "$PKG_STAGE_ROOT" \
  --identifier "com.openticket.installer" \
  --version "$PKG_VERSION" \
  "$PKG_OUT"

log "Kopiowanie .dmg/.zip do Moj"
DMG_SRC="$(find "$RELEASE_DIR" -maxdepth 2 -type f -name '*.dmg' | head -n 1 || true)"
ZIP_SRC="$(find "$RELEASE_DIR" -maxdepth 2 -type f -name '*.zip' | head -n 1 || true)"

if [[ -n "$DMG_SRC" ]]; then
  cp "$DMG_SRC" "$DMG_OUT"
fi
if [[ -n "$ZIP_SRC" ]]; then
  cp "$ZIP_SRC" "$ZIP_OUT"
fi

(
  cd "$MOJ_DIR"
  shasum -a 256 "$(basename "$PKG_OUT")" > "OpenTicket-Installer.pkg.sha256"
  if [[ -f "$DMG_OUT" ]]; then
    shasum -a 256 "$(basename "$DMG_OUT")" > "OpenTicket-Installer.dmg.sha256"
  fi
  if [[ -f "$ZIP_OUT" ]]; then
    shasum -a 256 "$(basename "$ZIP_OUT")" > "OpenTicket-Installer.zip.sha256"
  fi
)

if [[ -x "$README_LINK_UPDATER" ]]; then
  PKG_NAME="$(basename "$PKG_OUT")" "$README_LINK_UPDATER"
fi

log "Gotowe artefakty:"
ls -lh "$MOJ_DIR" | awk '{print "[Moj/build] " $0}'

log "Instalacja testowa: ./Moj/install-local.sh"
log "Deinstalacja: ./Moj/deinstaluj-openticket.sh"

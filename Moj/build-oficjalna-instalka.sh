#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOJ_DIR="$ROOT_DIR/Moj"
RELEASE_DIR="${RELEASE_DIR:-$ROOT_DIR/desktop/release-user}"
PKG_OUT="$MOJ_DIR/OpenTicket-Installer.pkg"
UNINSTALLER_PKG_OUT="$MOJ_DIR/OpenTicket-Uninstaller.pkg"
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
require_cmd hdiutil
require_cmd ditto

cd "$ROOT_DIR"

log "Czyszczenie poprzednich artefaktów"
rm -f "$PKG_OUT" "$UNINSTALLER_PKG_OUT" "$DMG_OUT" "$ZIP_OUT" "$MOJ_DIR"/*.sha256
rm -f "$MOJ_DIR"/latest-mac.yml "$MOJ_DIR"/OpenTicket-*.zip "$MOJ_DIR"/OpenTicket-*.zip.blockmap \
  "$MOJ_DIR"/OpenTicket-*.dmg "$MOJ_DIR"/OpenTicket-*.dmg.blockmap
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

log "Budowa backend"
npm --prefix backend run build

log "Budowa frontend"
npm --prefix frontend run build

log "Budowa desktop main"
npm --prefix desktop run build:electron

log "Budowa artefaktów macOS (.dmg/.zip + .app)"
(
  cd "$ROOT_DIR/desktop"
  npx electron-builder --mac --publish never --config.directories.output="$RELEASE_DIR"
)

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
PKG_SCRIPTS_DIR="$(mktemp -d "${TMPDIR:-/tmp}/openticket-pkg-scripts.XXXXXX")"
UNINSTALL_PKG_STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/openticket-uninstall-root.XXXXXX")"
UNINSTALL_PKG_SCRIPTS_DIR="$(mktemp -d "${TMPDIR:-/tmp}/openticket-uninstall-scripts.XXXXXX")"
trap 'rm -rf "$PKG_STAGE_ROOT" "$PKG_SCRIPTS_DIR" "$UNINSTALL_PKG_STAGE_ROOT" "$UNINSTALL_PKG_SCRIPTS_DIR"' EXIT

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

cat > "$PKG_SCRIPTS_DIR/postinstall" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

APP_PATH="/Applications/OpenTicket.app"
if [[ ! -d "$APP_PATH" ]]; then
  exit 0
fi

CONSOLE_USER="$(stat -f%Su /dev/console 2>/dev/null || true)"
if [[ -z "$CONSOLE_USER" || "$CONSOLE_USER" == "root" ]]; then
  exit 0
fi

CONSOLE_UID="$(id -u "$CONSOLE_USER" 2>/dev/null || true)"
if [[ -z "$CONSOLE_UID" ]]; then
  exit 0
fi

# Start setup assistant immediately after installation (without browser flow).
/bin/launchctl asuser "$CONSOLE_UID" /usr/bin/open -a "$APP_PATH" --args --setup-assistant --permissions-assistant >/dev/null 2>&1 || true
exit 0
EOF
chmod 755 "$PKG_SCRIPTS_DIR/postinstall"

# Defensively remove AppleDouble/resource-fork leftovers from staged payload.
find "$PKG_STAGE_ROOT" -name '._*' -type f -delete 2>/dev/null || true
xattr -rc "$PKG_STAGE_ROOT" 2>/dev/null || true

PKG_VERSION="$(node -p "require('./desktop/package.json').version")"

COPYFILE_DISABLE=1 COPY_EXTENDED_ATTRIBUTES_DISABLE=1 pkgbuild \
  --root "$PKG_STAGE_ROOT" \
  --scripts "$PKG_SCRIPTS_DIR" \
  --identifier "com.openticket.installer" \
  --version "$PKG_VERSION" \
  "$PKG_OUT"

log "Tworzenie pakietu deinstalatora (.pkg)"
mkdir -p "$UNINSTALL_PKG_STAGE_ROOT/private/tmp/openticket-uninstall"
cp -f "$UNINSTALLER_SOURCE" "$UNINSTALL_PKG_STAGE_ROOT/private/tmp/openticket-uninstall/uninstall-ticket-system.sh"
chmod 755 "$UNINSTALL_PKG_STAGE_ROOT/private/tmp/openticket-uninstall/uninstall-ticket-system.sh"

cat > "$UNINSTALL_PKG_SCRIPTS_DIR/postinstall" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

UNINSTALLER="/private/tmp/openticket-uninstall/uninstall-ticket-system.sh"
if [[ ! -x "$UNINSTALLER" ]]; then
  echo "Brak deinstalatora: $UNINSTALLER" >&2
  exit 1
fi

"$UNINSTALLER" --yes
rm -rf /private/tmp/openticket-uninstall >/dev/null 2>&1 || true
exit 0
EOF
chmod 755 "$UNINSTALL_PKG_SCRIPTS_DIR/postinstall"

COPYFILE_DISABLE=1 COPY_EXTENDED_ATTRIBUTES_DISABLE=1 pkgbuild \
  --root "$UNINSTALL_PKG_STAGE_ROOT" \
  --scripts "$UNINSTALL_PKG_SCRIPTS_DIR" \
  --identifier "com.openticket.uninstaller" \
  --version "$PKG_VERSION" \
  "$UNINSTALLER_PKG_OUT"

log "Tworzenie paczki instalacyjnej DMG/ZIP (zawiera plik .pkg)"
INSTALLER_STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/openticket-installer-media.XXXXXX")"
trap 'rm -rf "$PKG_STAGE_ROOT" "$PKG_SCRIPTS_DIR" "$UNINSTALL_PKG_STAGE_ROOT" "$UNINSTALL_PKG_SCRIPTS_DIR" "$INSTALLER_STAGE_DIR"' EXIT
cp -f "$PKG_OUT" "$INSTALLER_STAGE_DIR/"
cp -f "$UNINSTALLER_PKG_OUT" "$INSTALLER_STAGE_DIR/"
cat > "$INSTALLER_STAGE_DIR/README.txt" <<'EOF'
OpenTicket Installer
===================

1) Uruchom OpenTicket-Installer.pkg
2) Po instalacji aplikacja jest w /Applications/OpenTicket.app
3) Deinstalator: OpenTicket-Uninstaller.pkg
EOF

if ! hdiutil create -volname "OpenTicket Installer" -srcfolder "$INSTALLER_STAGE_DIR" -ov -format UDZO "$DMG_OUT" >/dev/null; then
  log "UWAGA: nie udało się utworzyć DMG z instalatorem."
fi

if ! (cd "$INSTALLER_STAGE_DIR" && ditto -c -k --sequesterRsrc --keepParent . "$ZIP_OUT"); then
  log "UWAGA: nie udało się utworzyć ZIP z instalatorem."
fi

log "Kopiowanie artefaktów auto-update macOS (latest-mac.yml + pliki wskazane)"
MAC_UPDATE_YML="$RELEASE_DIR/latest-mac.yml"
if [[ -f "$MAC_UPDATE_YML" ]]; then
  if ! cp "$MAC_UPDATE_YML" "$MOJ_DIR/latest-mac.yml"; then
    log "UWAGA: nie udało się skopiować latest-mac.yml (brak miejsca)."
  fi
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    if [[ -f "$RELEASE_DIR/$rel" ]]; then
      cp "$RELEASE_DIR/$rel" "$MOJ_DIR/$rel" || log "UWAGA: pominięto kopiowanie $rel (brak miejsca)."
    fi
    if [[ -f "$RELEASE_DIR/$rel.blockmap" ]]; then
      cp "$RELEASE_DIR/$rel.blockmap" "$MOJ_DIR/$rel.blockmap" || log "UWAGA: pominięto kopiowanie $rel.blockmap (brak miejsca)."
    fi
  done < <(
    awk '
      /^path:[[:space:]]*/ { print $2 }
      /^[[:space:]]*-[[:space:]]*url:[[:space:]]*/ { print $3 }
    ' "$MAC_UPDATE_YML" | tr -d '"' | sort -u
  )
else
  log "UWAGA: brak $MAC_UPDATE_YML (auto-update macOS może nie działać)"
fi

(
  cd "$MOJ_DIR"
  shasum -a 256 "$(basename "$PKG_OUT")" > "OpenTicket-Installer.pkg.sha256"
  shasum -a 256 "$(basename "$UNINSTALLER_PKG_OUT")" > "OpenTicket-Uninstaller.pkg.sha256"
  if [[ -f "$DMG_OUT" ]]; then
    shasum -a 256 "$(basename "$DMG_OUT")" > "OpenTicket-Installer.dmg.sha256"
  fi
  if [[ -f "$ZIP_OUT" ]]; then
    shasum -a 256 "$(basename "$ZIP_OUT")" > "OpenTicket-Installer.zip.sha256"
  fi
  if [[ -f "latest-mac.yml" ]]; then
    shasum -a 256 "latest-mac.yml" > "latest-mac.yml.sha256"
  fi
  for f in OpenTicket-*.zip OpenTicket-*.zip.blockmap OpenTicket-*.dmg OpenTicket-*.dmg.blockmap; do
    if [[ -f "$f" ]]; then
      shasum -a 256 "$f" > "$f.sha256"
    fi
  done
)

if [[ -x "$README_LINK_UPDATER" ]]; then
  PKG_NAME="$(basename "$PKG_OUT")" "$README_LINK_UPDATER"
fi

log "Gotowe artefakty:"
ls -lh "$MOJ_DIR" | awk '{print "[Moj/build] " $0}'

log "Instalacja testowa: ./Moj/install-local.sh"
log "Deinstalacja: ./Moj/deinstaluj-openticket.sh"

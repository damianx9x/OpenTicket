#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOJ_DIR="$ROOT_DIR/Moj"
if [[ -n "${RELEASE_DIR:-}" ]]; then
  RELEASE_DIR="$RELEASE_DIR"
  RELEASE_DIR_USER_SET=1
else
  RELEASE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/openticket-release.XXXXXX")"
  RELEASE_DIR_USER_SET=0
fi
ORIGINAL_RELEASE_DIR="$RELEASE_DIR"
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

cleanup_workspace_release_dirs() {
  local desktop_dir="$ROOT_DIR/desktop"
  local removed=0
  local leftover=0
  while IFS= read -r old_dir; do
    [[ -z "$old_dir" ]] && continue
    if rm -rf "$old_dir" 2>/dev/null; then
      removed=$((removed + 1))
    else
      leftover=$((leftover + 1))
      touch "$old_dir/.metadata_never_index" 2>/dev/null || true
      log "UWAGA: nie mogę usunąć $old_dir (uprawnienia). Dodano .metadata_never_index, jeśli możliwe."
    fi
  done < <(
    find "$desktop_dir" -maxdepth 1 -mindepth 1 -type d \
      \( -name 'release' -o -name 'release-*' -o -name 'release-user*' \) 2>/dev/null || true
  )
  if [[ $removed -gt 0 ]]; then
    log "Usunięto stare katalogi build app z workspace: $removed"
  fi
  if [[ $leftover -gt 0 ]]; then
    log "Pozostały katalogi build app (brak uprawnień): $leftover. Aby usunąć całkowicie: sudo rm -rf $desktop_dir/release* $desktop_dir/release-user*"
  fi
}

prepare_release_dir() {
  if [[ "$RELEASE_DIR_USER_SET" -eq 1 ]]; then
    if [[ -e "$RELEASE_DIR" ]] && ! rm -rf "$RELEASE_DIR" 2>/dev/null; then
      local fallback="$ROOT_DIR/desktop/release-user-$(date +%Y%m%d-%H%M%S)"
      log "UWAGA: brak uprawnień do czyszczenia $RELEASE_DIR. Używam fallback: $fallback"
      RELEASE_DIR="$fallback"
    fi
    rm -rf "$RELEASE_DIR"
    mkdir -p "$RELEASE_DIR"
  else
    rm -rf "$RELEASE_DIR"
    mkdir -p "$RELEASE_DIR"
  fi
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
require_cmd productbuild
require_cmd hdiutil
require_cmd ditto

cd "$ROOT_DIR"

log "Czyszczenie poprzednich artefaktów"
rm -f "$PKG_OUT" "$UNINSTALLER_PKG_OUT" "$DMG_OUT" "$ZIP_OUT" "$MOJ_DIR"/*.sha256
rm -f "$MOJ_DIR"/latest-mac.yml "$MOJ_DIR"/OpenTicket-*.zip "$MOJ_DIR"/OpenTicket-*.zip.blockmap \
  "$MOJ_DIR"/OpenTicket-*.dmg "$MOJ_DIR"/OpenTicket-*.dmg.blockmap
cleanup_workspace_release_dirs
prepare_release_dir

log "Budowa backend"
npm --prefix backend run build

log "Budowa frontend"
npm --prefix frontend run build

log "Budowa desktop main"
npm --prefix desktop run build:electron

log "Budowa artefaktów macOS (zip + .app)"
build_mac_artifacts() {
  (
    cd "$ROOT_DIR/desktop"
    # Build only zip target here (dmg in electron-builder is flaky on some macOS hosts due hdiutil resize race).
    # We generate user-facing DMG from installer payload later in this script.
    npx electron-builder --mac zip --publish never --config.directories.output="$RELEASE_DIR"
  )
}

if ! build_mac_artifacts; then
  if [[ "${OPENTICKET_ALLOW_UNSIGNED_BUILD:-1}" == "1" ]]; then
    log "UWAGA: podpisywanie macOS nie powiodło się (np. problem timestamp/clock). Przechodzę na build unsigned."
    (
      cd "$ROOT_DIR/desktop"
      CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac zip --publish never --config.directories.output="$RELEASE_DIR"
    )
  else
    echo "Budowa artefaktów macOS nieudana. Ustaw OPENTICKET_ALLOW_UNSIGNED_BUILD=1 aby wymusić fallback unsigned."
    exit 1
  fi
fi

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
APP_PKG_STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/openticket-app-root.XXXXXX")"
PKG_SCRIPTS_DIR="$(mktemp -d "${TMPDIR:-/tmp}/openticket-pkg-scripts.XXXXXX")"
PKG_COMPONENTS_DIR="$(mktemp -d "${TMPDIR:-/tmp}/openticket-pkg-components.XXXXXX")"
APP_COMPONENT_PLIST="$(mktemp "${TMPDIR:-/tmp}/openticket-app-component.XXXXXX.plist")"
PRODUCT_DISTRIBUTION="$(mktemp "${TMPDIR:-/tmp}/openticket-product-dist.XXXXXX.xml")"
UNINSTALL_PKG_STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/openticket-uninstall-root.XXXXXX")"
UNINSTALL_PKG_SCRIPTS_DIR="$(mktemp -d "${TMPDIR:-/tmp}/openticket-uninstall-scripts.XXXXXX")"
APP_COMPONENT_PKG="$PKG_COMPONENTS_DIR/OpenTicket-App.pkg"
SUPPORT_COMPONENT_PKG="$PKG_COMPONENTS_DIR/OpenTicket-Support.pkg"
trap 'rm -rf "$PKG_STAGE_ROOT" "$APP_PKG_STAGE_ROOT" "$PKG_SCRIPTS_DIR" "$PKG_COMPONENTS_DIR" "$UNINSTALL_PKG_STAGE_ROOT" "$UNINSTALL_PKG_SCRIPTS_DIR"; rm -f "$APP_COMPONENT_PLIST" "$PRODUCT_DISTRIBUTION"' EXIT

mkdir -p "$PKG_STAGE_ROOT/Applications"
mkdir -p "$PKG_STAGE_ROOT/Library/Application Support/OpenTicket"
mkdir -p "$APP_PKG_STAGE_ROOT/Applications"

export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1

ditto --norsrc --noextattr "$APP_BUNDLE" "$APP_PKG_STAGE_ROOT/Applications/OpenTicket.app"
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

CONSOLE_USER="$(stat -f%Su /dev/console 2>/dev/null || true)"
if [[ -z "$CONSOLE_USER" || "$CONSOLE_USER" == "root" ]]; then
  exit 0
fi

CONSOLE_UID="$(id -u "$CONSOLE_USER" 2>/dev/null || true)"
if [[ -z "$CONSOLE_UID" ]]; then
  exit 0
fi

SYSTEM_APP="/Applications/OpenTicket.app"
USER_APP="/Users/$CONSOLE_USER/Applications/OpenTicket.app"

# Enforce system location. If package landed in user domain, move it to /Applications.
if [[ ! -d "$SYSTEM_APP" && -d "$USER_APP" ]]; then
  /bin/mkdir -p /Applications >/dev/null 2>&1 || true
  /usr/bin/ditto "$USER_APP" "$SYSTEM_APP" >/dev/null 2>&1 || true
  /bin/rm -rf "$USER_APP" >/dev/null 2>&1 || true
fi

if [[ ! -d "$SYSTEM_APP" ]]; then
  /usr/bin/logger -t openticket-installer "OpenTicket.app missing after install (checked /Applications and user domain)"
  exit 0
fi

# Keep only system copy to avoid Spotlight duplicates.
if [[ -d "$USER_APP" ]]; then
  /bin/rm -rf "$USER_APP" >/dev/null 2>&1 || true
fi

# Clear quarantine if present (best-effort).
/usr/bin/xattr -dr com.apple.quarantine "$SYSTEM_APP" >/dev/null 2>&1 || true

# Start setup assistant immediately after installation.
if /bin/launchctl asuser "$CONSOLE_UID" /usr/bin/open -na "$SYSTEM_APP" --args --setup-assistant --permissions-assistant >/dev/null 2>&1; then
  exit 0
fi

if /usr/bin/su - "$CONSOLE_USER" -c "/usr/bin/open -na '/Applications/OpenTicket.app' --args --setup-assistant --permissions-assistant" >/dev/null 2>&1; then
  exit 0
fi

# Fallback: at least open WebUI setup in browser.
/bin/launchctl asuser "$CONSOLE_UID" /usr/bin/open "http://127.0.0.1:3200/setup?source=installer" >/dev/null 2>&1 || true
exit 0
EOF
chmod 755 "$PKG_SCRIPTS_DIR/postinstall"

PKG_VERSION="$(node -p "require('./desktop/package.json').version")"

# App component (strictly /Applications, non-relocatable).
cat > "$APP_COMPONENT_PLIST" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
  <dict>
    <key>RootRelativeBundlePath</key>
    <string>Applications/OpenTicket.app</string>
    <key>BundleIsRelocatable</key>
    <false/>
    <key>BundleHasStrictIdentifier</key>
    <true/>
    <key>BundleIsVersionChecked</key>
    <true/>
    <key>BundleOverwriteAction</key>
    <string>upgrade</string>
  </dict>
</array>
</plist>
EOF

COPYFILE_DISABLE=1 COPY_EXTENDED_ATTRIBUTES_DISABLE=1 pkgbuild \
  --root "$APP_PKG_STAGE_ROOT" \
  --install-location "/" \
  --component-plist "$APP_COMPONENT_PLIST" \
  --identifier "com.openticket.installer.app" \
  --version "$PKG_VERSION" \
  "$APP_COMPONENT_PKG"

# Support component (uninstaller scripts + postinstall auto-run).
find "$PKG_STAGE_ROOT" -name '._*' -type f -delete 2>/dev/null || true
xattr -rc "$PKG_STAGE_ROOT" 2>/dev/null || true
COPYFILE_DISABLE=1 COPY_EXTENDED_ATTRIBUTES_DISABLE=1 pkgbuild \
  --root "$PKG_STAGE_ROOT" \
  --scripts "$PKG_SCRIPTS_DIR" \
  --install-location "/" \
  --identifier "com.openticket.installer.support" \
  --version "$PKG_VERSION" \
  "$SUPPORT_COMPONENT_PKG"

# Final product pkg with system-domain only.
cat > "$PRODUCT_DISTRIBUTION" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
  <title>OpenTicket</title>
  <domains enable_anywhere="false" enable_currentUserHome="false" enable_localSystem="true"/>
  <options customize="never" hostArchitectures="arm64,x86_64"/>
  <choices-outline>
    <line choice="com.openticket.choice"/>
  </choices-outline>
  <choice id="com.openticket.choice" title="OpenTicket" visible="false">
    <pkg-ref id="com.openticket.installer.app"/>
    <pkg-ref id="com.openticket.installer.support"/>
  </choice>
  <pkg-ref id="com.openticket.installer.app" version="$PKG_VERSION">$(basename "$APP_COMPONENT_PKG")</pkg-ref>
  <pkg-ref id="com.openticket.installer.support" version="$PKG_VERSION">$(basename "$SUPPORT_COMPONENT_PKG")</pkg-ref>
</installer-gui-script>
EOF

productbuild \
  --distribution "$PRODUCT_DISTRIBUTION" \
  --package-path "$PKG_COMPONENTS_DIR" \
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
trap 'rm -rf "$PKG_STAGE_ROOT" "$APP_PKG_STAGE_ROOT" "$PKG_SCRIPTS_DIR" "$PKG_COMPONENTS_DIR" "$UNINSTALL_PKG_STAGE_ROOT" "$UNINSTALL_PKG_SCRIPTS_DIR" "$INSTALLER_STAGE_DIR"; rm -f "$APP_COMPONENT_PLIST" "$PRODUCT_DISTRIBUTION"' EXIT
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
if [[ "$RELEASE_DIR_USER_SET" -eq 0 ]]; then
  rm -rf "$RELEASE_DIR" >/dev/null 2>&1 || true
  log "INFO: tymczasowy katalog build app usunięty (brak indexowania Spotlight w workspace)."
elif [[ "$RELEASE_DIR" != "$ORIGINAL_RELEASE_DIR" ]]; then
  log "INFO: build output utworzony w fallback katalogu: $RELEASE_DIR"
fi

log "Instalacja testowa: ./Moj/install-local.sh"
log "Deinstalacja: ./Moj/deinstaluj-openticket.sh"

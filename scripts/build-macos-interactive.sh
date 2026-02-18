#!/bin/bash
# Ticket System - macOS App Builder (Interactive)
# Kompiluje aplikację macOS z konfiguracją ścieżek dla backendu i bazy danych
# Wersja stand-alone - No external dependencies required

set -e -o pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="/tmp/ticket-app-build-$$"
DIST_DIR="${PROJECT_DIR}/dist"
FINAL_DIR="${PROJECT_DIR}/final/MacOS"
APP_NAME="Apple Service"
DMG_FILE="ticket-system-installer.dmg"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
log_header() {
    echo -e "${GREEN}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${NC}"
    echo -e "${GREEN}┃  $1${NC}"
    echo -e "${GREEN}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${NC}"
}

log_step() {
    echo -e "${YELLOW}→ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

cleanup() {
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR" 2>/dev/null || true
    fi
    diskutil list 2>/dev/null | grep -q "Apple Service" && {
        diskutil unmount force "/Volumes/Apple Service" 2>/dev/null || true
    }
}

trap cleanup EXIT INT TERM

# ============================================================================
# CONFIGURATION SECTION
# ============================================================================

log_header "Apple Service - macOS Application Builder"
echo ""
echo -e "${BLUE}Konfiguracja aplikacji:${NC}"
echo ""

# 1. Backend URL
echo -e "${YELLOW}1. Adres backendu (API):${NC}"
echo "   a) Lokalny (default): http://localhost:3000"
echo "   b) Zdalny - podaj URL"
echo "   c) Brak backendu (standalone mode)"
read -p "Wybór (a/b/c) [a]: " backend_choice
backend_choice=${backend_choice:-a}

case $backend_choice in
    a) BACKEND_URL="http://localhost:3000" ;;
    b) read -p "Wpisz URL backendu: " BACKEND_URL ;;
    c) BACKEND_URL="" ;;
    *) log_error "Niepoprawny wybór"; exit 1 ;;
esac

# 2. Database Path
echo -e "${YELLOW}2. Ścieżka do bazy danych:${NC}"
echo "   a) Default (~/Library/Application Support/Apple Service): [default]"
echo "   b) Niestandardowa - podaj ścieżkę"
echo "   c) In-memory (testy)"
read -p "Wybór (a/b/c) [a]: " db_choice
db_choice=${db_choice:-a}

case $db_choice in
    a) DB_PATH="~/Library/Application Support/Apple Service" ;;
    b) read -p "Wpisz ścieżkę do bazy: " DB_PATH ;;
    c) DB_PATH=":memory:" ;;
    *) log_error "Niepoprawny wybór"; exit 1 ;;
esac

# 3. Data Directory
echo -e "${YELLOW}3. Folder na dane użytkownika (tickets, attachments, etc):${NC}"
echo "   a) Default (~/Documents/Apple Service Data): [default]"
echo "   b) Niestandardowa - podaj ścieżkę"
read -p "Wybór (a/b) [a]: " data_choice
data_choice=${data_choice:-a}

case $data_choice in
    a) DATA_PATH="~/Documents/Apple Service Data" ;;
    b) read -p "Wpisz ścieżkę do danych: " DATA_PATH ;;
    *) log_error "Niepoprawny wybór"; exit 1 ;;
esac

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}KONFIGURACJA:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo "  Backend URL:  ${BACKEND_URL:-'(brak - standalone mode)'}"
echo "  Database:     $DB_PATH"
echo "  Data Folder:  $DATA_PATH"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
read -p "Czy potwierdzasz konfigurację? (y/n) [y]: " confirm
confirm=${confirm:-y}

if [ "$confirm" != "y" ]; then
    log_error "Anulowano"
    exit 0
fi

# ============================================================================
# BUILD PROCESS
# ============================================================================

log_header "Budowanie Aplikacji"

# Step 1: Cleanup
log_step "Czyszczenie starych builów"
rm -rf "$BUILD_DIR" "$DIST_DIR/Apple Service.app" 2>/dev/null || true
mkdir -p "$BUILD_DIR" "$DIST_DIR" "$FINAL_DIR"
log_success "Katalogi przygotowane"

# Step 2: Create App Bundle Structure
log_step "Tworzenie struktury aplikacji"
mkdir -p "$BUILD_DIR/App"
mkdir -p "$BUILD_DIR/App/Payload/Apple Service.app/Contents"
mkdir -p "$BUILD_DIR/App/Payload/Apple Service.app/Contents/MacOS"
mkdir -p "$BUILD_DIR/App/Payload/Apple Service.app/Contents/Resources"

# Step 3: Create Launcher Script
log_step "Tworzenie launcher skryptu"
cat > "$BUILD_DIR/App/Payload/Apple Service.app/Contents/MacOS/launcher" << 'EOF'
#!/bin/bash

# Apple Service - macOS Launcher
# Uruchamia aplikację z odpowiednią konfiguracją

APP_DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"
CONFIG_FILE="$HOME/.apple-service/config.json"
LOG_FILE="$HOME/Library/Logs/Apple Service/launcher.log"

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Create default config if missing
if [ ! -f "$CONFIG_FILE" ]; then
    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << 'CONFIG'
{
  "version": "1.0.0",
  "backend": "{BACKEND_URL}",
  "database": "{DB_PATH}",
  "dataPath": "{DATA_PATH}",
  "features": {
    "offlineMode": true,
    "pushNotifications": false,
    "emailIntegration": false
  }
}
CONFIG
fi

# Log launch
echo "[$(date)] Launching Apple Service..." >> "$LOG_FILE"
echo "Config: $CONFIG_FILE" >> "$LOG_FILE"

# Open the WebUI
open "$APP_DIR/index.html"

# Alternative: If you have a native executable
# "$APP_DIR/bin/apple-service" "$CONFIG_FILE"
EOF

chmod +x "$BUILD_DIR/App/Payload/Apple Service.app/Contents/MacOS/launcher"
log_success "Launcher skrypt utworzony"

# Step 4: Copy Resources (HTML UI)
log_step "Kopiowanie zasobów"
cp "${PROJECT_DIR}/demo-full.html" "$BUILD_DIR/App/Payload/Apple Service.app/Contents/Resources/index.html"
log_success "WebUI skopiowana"

# Step 5: Create Info.plist
log_step "Tworzenie Info.plist"
cat > "$BUILD_DIR/App/Payload/Apple Service.app/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIdentifier</key>
    <string>local.applservice.ticketing</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>Apple Service</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.14</string>
    <key>NSMainStoryboardFile</key>
    <string></string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2026 Apple Service. All rights reserved.</string>
</dict>
</plist>
PLIST
log_success "Info.plist utworzony"

# Step 6: Create PkgInfo
log_step "Tworzenie metadanych pakietu"
echo -n "APPL????" > "$BUILD_DIR/App/Payload/Apple Service.app/Contents/PkgInfo"
log_success "Metadane pakietu utworzone"

# Step 7: Replace Configuration Variables
log_step "Wstawianie konfiguracji"
sed -i "" "s|{BACKEND_URL}|${BACKEND_URL}|g" "$BUILD_DIR/App/Payload/Apple Service.app/Contents/MacOS/launcher"
sed -i "" "s|{DB_PATH}|${DB_PATH}|g" "$BUILD_DIR/App/Payload/Apple Service.app/Contents/MacOS/launcher"
sed -i "" "s|{DATA_PATH}|${DATA_PATH}|g" "$BUILD_DIR/App/Payload/Apple Service.app/Contents/MacOS/launcher"
log_success "Konfiguracja ustawiona"

# Step 8: Create DMG
log_step "Tworzenie DMG instalatora"

# Create temporary DMG
DMG_TEMP="${BUILD_DIR}/temp.dmg"
hdiutil create \
    -volname "Apple Service" \
    -srcfolder "$BUILD_DIR/App/Payload" \
    -format UDRW \
    -o "$DMG_TEMP" 2>&1 | tail -5

# Mount and customize
MOUNT_POINT="/Volumes/Apple Service"
diskutil unmount force "$MOUNT_POINT" 2>/dev/null || true
sleep 1
hdiutil attach "$DMG_TEMP" -readwrite -noautoopen

# Create symlink to Applications
ln -sf /Applications "$MOUNT_POINT/Applications" 2>/dev/null || true

# Create .background
mkdir -p "$MOUNT_POINT/.background"
cat > "$MOUNT_POINT/.background/bg.html" << 'BG'
<html><body style="margin:0;padding:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)"></body></html>
BG

# Detach
diskutil unmount force "$MOUNT_POINT" 2>/dev/null || true
sleep 1

# Convert to compressed
DMG_OUTPUT="${FINAL_DIR}/${DMG_FILE}"
hdiutil convert "$DMG_TEMP" -format UDZO -o "${DMG_OUTPUT}" 2>&1 | tail -5
rm -f "$DMG_TEMP"

log_success "DMG Created: ${DMG_OUTPUT}"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
log_header "Build Ukończony ✓"
echo ""
echo -e "${GREEN}Aplikacja wbudowana pomyślnie!${NC}"
echo ""
echo -e "${BLUE}Instalacja:${NC}"
echo "  1. open ${DMG_OUTPUT}"
echo "  2. Przeciągnij 'Apple Service' do 'Applications'"
echo "  3. Uruchom z Launchpad lub Spotlight"
echo ""
echo -e "${BLUE}Konfiguracja:${NC}"
echo "  Plik konfiguracyjny: ~/.apple-service/config.json"
echo "  Logi: ~/Library/Logs/Apple Service/"
echo ""
echo -e "${BLUE}Rozmiar:${NC}"
ls -lh "${DMG_OUTPUT}" | awk '{print "  " $5 " - " $9}'
echo ""
log_success "Gotowe do dystrybucji!"
echo ""

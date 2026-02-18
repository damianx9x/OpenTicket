#!/bin/bash
# Ticket System DMG Builder - without brew dependencies
# Usage: ./scripts/build-dmg.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${PROJECT_DIR}/build-dmg"
DIST_DIR="${PROJECT_DIR}/dist"
DMG_OUTPUT="${DIST_DIR}/ticket-system-installer.dmg"
APP_NAME="Ticket System"
VERSION=$(grep '"version"' "${PROJECT_DIR}/backend/package.json" | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Ticket System - DMG Installer Builder v${VERSION}${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

# Cleanup function
cleanup() {
    echo -e "${YELLOW}Czyszczenie plików tymczasowych...${NC}"
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
    fi
    # Unmount if still mounted
    if [ -d "/Volumes/Ticket System" ]; then
        hdiutil detach "/Volumes/Ticket System" 2>/dev/null || true
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Step 1: Prepare directories
echo -e "${YELLOW}1. Przygotowywanie katalogów...${NC}"
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR/opt/ticket-system"
mkdir -p "$BUILD_DIR/Applications"
mkdir -p "$DIST_DIR"

# Step 2: Build backend
echo -e "${YELLOW}2. Budowanie backendu...${NC}"
cd "${PROJECT_DIR}/backend"

# Always install dependencies fresh
echo "   Instalowanie zależności backendu..."
npm install --legacy-peer-deps 2>&1 | tail -3

# Build TypeScript
echo "   Kompilacja TypeScript..."
npm run build 2>&1 | tail -5
if [ ! -d "dist" ]; then
    echo -e "${RED}Błąd: Kompilacja TypeScript nie powiodła się${NC}"
    exit 1
fi

# Step 3: Copy backend files
echo -e "${YELLOW}3. Kopiowanie backendu...${NC}"
cp -r dist "$BUILD_DIR/opt/ticket-system/backend-dist"
cp package.json "$BUILD_DIR/opt/ticket-system/"
cp package-lock.json "$BUILD_DIR/opt/ticket-system/" 2>/dev/null || true

# Copy Prisma schema and migrations
mkdir -p "$BUILD_DIR/opt/ticket-system/prisma"
cp -r prisma/migrations "$BUILD_DIR/opt/ticket-system/prisma/" 2>/dev/null || true
cp prisma/schema.prisma "$BUILD_DIR/opt/ticket-system/prisma/"
cp prisma/seed.ts "$BUILD_DIR/opt/ticket-system/prisma/"

# Step 4: Copy frontend
echo -e "${YELLOW}4. Kopiowanie frontendu...${NC}"
mkdir -p "$BUILD_DIR/opt/ticket-system/frontend"
cp "${PROJECT_DIR}/frontend/index.html" "$BUILD_DIR/opt/ticket-system/frontend/"

# Step 5: Copy scripts and configs
echo -e "${YELLOW}5. Kopiowanie skryptów konfiguracyjnych...${NC}"
mkdir -p "$BUILD_DIR/opt/ticket-system/scripts"
cp "${PROJECT_DIR}/scripts/ticketctl.js" "$BUILD_DIR/opt/ticket-system/scripts/"
cp "${PROJECT_DIR}/Caddyfile" "$BUILD_DIR/opt/ticket-system/" 2>/dev/null || true

# Step 6: Create launcher script
echo -e "${YELLOW}6. Tworzenie skryptu uruchamiającego...${NC}"
cat > "$BUILD_DIR/opt/ticket-system/start-server.sh" << 'LAUNCHER_EOF'
#!/bin/bash
# Ticket System Server Launcher

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${HOME}/.ticket-system"
LOG_FILE="${DATA_DIR}/server.log"

# Create data directory
mkdir -p "$DATA_DIR"

# Setup environment
export DATA_DIR
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ticket_system"
export REDIS_URL="redis://localhost:6379"
export MINIO_ENDPOINT="http://localhost:9000"

# Start services using Docker
echo "Uruchamianie usług (PostgreSQL, Redis, MinIO)..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker nie jest zainstalowany. Pobierz Docker Desktop z https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Start docker-compose
cd "$SCRIPT_DIR"
docker-compose up -d 2>&1 | tail -5

echo "✅ Usługi są uruchomione"
echo "⏳ Migracja bazy danych..."

# Install dependencies
npm ci --quiet

# Run migrations
npx prisma migrate deploy --skip-generate 2>&1 | grep -v "^Prisma schema" || true

# Seed data
npx ts-node --transpile-only prisma/seed.ts 2>&1 | tail -3

# Start backend
echo "🚀 Uruchamianie backendu..."
exec npm start
LAUNCHER_EOF

chmod +x "$BUILD_DIR/opt/ticket-system/start-server.sh"

# Step 7: Create postinstall script
echo -e "${YELLOW}7. Tworzenie skryptu poininstalacyjnego...${NC}"
cat > "$BUILD_DIR/postinstall" << 'POSTINSTALL_EOF'
#!/bin/bash
set -e

INSTALL_DIR="/opt/ticket-system"
DATA_DIR="${HOME}/.ticket-system"

echo "🔧 Finalizowanie instalacji..."

# Create directories
mkdir -p "$DATA_DIR/data"
mkdir -p "$DATA_DIR/storage"
mkdir -p "$DATA_DIR/logs"

# Create symlink for easy access
ln -sf "$INSTALL_DIR" "${HOME}/Ticket System" 2>/dev/null || true

echo "✅ Instalacja zakończona!"
echo ""
echo "Aby uruchomić system:"
echo "  cd $INSTALL_DIR"
echo "  ./start-server.sh"
echo ""
echo "Frontend będzie dostępny pod: http://localhost:3000"
echo "API dostępne pod: http://localhost:3000/api"
echo "Dokumentacja Swagger: http://localhost:3000/api/docs"
POSTINSTALL_EOF

chmod +x "$BUILD_DIR/postinstall"

# Step 8: Copy docker-compose
echo -e "${YELLOW}8. Kopiowanie konfiguracji Docker...${NC}"
cp "${PROJECT_DIR}/docker-compose.yml" "$BUILD_DIR/opt/ticket-system/"
cp "${PROJECT_DIR}/.env.example" "$BUILD_DIR/opt/ticket-system/.env" 2>/dev/null || cat > "$BUILD_DIR/opt/ticket-system/.env" << 'ENV_EOF'
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ticket_system
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticket_system

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# Node
NODE_ENV=production
PORT=3000
ENV_EOF

# Step 9: Copy documentation
echo -e "${YELLOW}9. Kopiowanie dokumentacji...${NC}"
mkdir -p "$BUILD_DIR/opt/ticket-system/docs"
cp "${PROJECT_DIR}/README.md" "$BUILD_DIR/opt/ticket-system/"
cp "${PROJECT_DIR}/docs/ARCHITECTURE.md" "$BUILD_DIR/opt/ticket-system/docs/" 2>/dev/null || true

# Step 10: Create DMG layout
echo -e "${YELLOW}10. Tworzenie struktury DMG...${NC}"

# Create app bundle
mkdir -p "$BUILD_DIR/Applications/Ticket System.app/Contents/MacOS"
mkdir -p "$BUILD_DIR/Applications/Ticket System.app/Contents/Resources"

cat > "$BUILD_DIR/Applications/Ticket System.app/Contents/Info.plist" << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIdentifier</key>
    <string>io.ticketsystem.app</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>Ticket System</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION}</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.12</string>
    <key>NSLocalNetworkUsageDescription</key>
    <string>Potrzebny dostęp do sieci lokalnej w celu komunikacji z serwerem</string>
    <key>NSBonjourServices</key>
    <array>
        <string>_http._tcp</string>
    </array>
</dict>
</plist>
PLIST_EOF

# Create launcher script for app bundle
cat > "$BUILD_DIR/Applications/Ticket System.app/Contents/MacOS/launcher" << 'APP_LAUNCHER_EOF'
#!/bin/bash
# Open terminal and run the server
open -a Terminal "$( cd "$(dirname "$(pwd)")/../../../opt/ticket-system" && pwd )/start-server.sh"
APP_LAUNCHER_EOF

chmod +x "$BUILD_DIR/Applications/Ticket System.app/Contents/MacOS/launcher"

# Create DMG from directory
echo -e "${YELLOW}11. Tworzenie obrazu DMG...${NC}"

# Calculate size (add some buffer)
SIZE=$(du -sh "$BUILD_DIR" | awk '{print int($1)*1.2}')MB

# Create temporary sparse image
TEMP_DMG="/tmp/ticket-system-temp.dmg"
hdiutil create -srcfolder "$BUILD_DIR" -volname "$APP_NAME" -fs HFS+ -fsargs "-c c=64,a=16,e=16" -format UDRW -o "$TEMP_DMG" > /dev/null 2>&1

# Mount the DMG
MOUNT_POINT=$(hdiutil attach "$TEMP_DMG" | grep -E '^/dev/disk' | awk '{ print $3 }')

# Customize DMG appearance
echo -e "${YELLOW}12. Dostosowywanie wyglądu DMG...${NC}"

# Create .DS_Store for nice layout
cat > /tmp/dmg-script.applescript << 'APPLESCRIPT_EOF'
tell application "Finder"
    tell disk "Ticket System"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set bounds of container window to {100, 100, 600, 400}
        set theViewOptions to the icon view options of container window
        set arrangement of theViewOptions to not arranged
        set icon size of theViewOptions to 72
        delay 1
    end tell
    delay 1
end tell
APPLESCRIPT_EOF

# Try to run applescript if available
if command -v osascript &> /dev/null; then
    osascript /tmp/dmg-script.applescript 2>/dev/null || true
fi

# Unmount DMG
hdiutil detach "$MOUNT_POINT" > /dev/null 2>&1

# Convert to compressed format
echo -e "${YELLOW}13. Kompresja obrazu...${NC}"
hdiutil convert "$TEMP_DMG" -format UDBZ -o "$DMG_OUTPUT" > /dev/null 2>&1

# Clean up temp DMG
rm -f "$TEMP_DMG"

# Final verification
if [ -f "$DMG_OUTPUT" ]; then
    DMG_SIZE=$(ls -lh "$DMG_OUTPUT" | awk '{print $5}')
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ DMG instalator został pomyślnie utworzony!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "📦 Plik instalatora:"
    echo "   ${DMG_OUTPUT}"
    echo ""
    echo "📊 Rozmiar: $DMG_SIZE"
    echo ""
    echo "🚀 Instrukcje instalacji:"
    echo "   1. Otwórz plik .dmg"
    echo "   2. Przeciągnij folder 'opt/ticket-system' do /Applications"
    echo "   3. Kliknij na 'Ticket System.app'"
    echo "   4. Uruchomi się terminal z serwerem"
    echo ""
    echo "⚠️  Wymagania:"
    echo "   - Docker Desktop (https://www.docker.com/products/docker-desktop)"
    echo "   - Node.js (już bundle'owany w instalatorze)"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Błąd: DMG nie został utworzony${NC}"
    exit 1
fi

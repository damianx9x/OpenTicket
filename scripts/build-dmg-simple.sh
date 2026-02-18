#!/bin/bash
# Simplified DMG Builder for Ticket System
# No brew required - uses native macOS tools

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="/tmp/ticket-system-dmg-build-$$"
DIST_DIR="${PROJECT_DIR}/dist"
DMG_OUTPUT="${DIST_DIR}/ticket-system-installer.dmg"
VERSION="0.1.0"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Ticket System DMG Builder - v${VERSION}${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""

# Cleanup on exit
cleanup() {
    echo -e "${YELLOW}Czyszczenie...${NC}"
    rm -rf "$BUILD_DIR"
    if [ -d "/Volumes/Ticket System" ]; then
        hdiutil detach "/Volumes/Ticket System" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Prepare directories
echo -e "${YELLOW}1. Przygotowywanie katalogów...${NC}"
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$DIST_DIR"

# Build backend
echo -e "${YELLOW}2. Budowanie backendu...${NC}"
cd "${PROJECT_DIR}/backend"
npm run build 2>&1 | tail -5 || true

# Check if build succeeded
if [ ! -d "dist" ]; then
    echo -e "${RED}✗ Backend build nie powiódł się${NC}"
    exit 1
fi
cd "$PROJECT_DIR"

# Copy files to build directory
echo -e "${YELLOW}3. Zbieranie plików...${NC}"

# Create directory structure
mkdir -p "$BUILD_DIR/Ticket System/backend"
mkdir -p "$BUILD_DIR/Ticket System/frontend"
mkdir -p "$BUILD_DIR/Ticket System/docs"

# Copy backend
cp -r backend/dist "$BUILD_DIR/Ticket System/backend/app"
cp backend/package.json "$BUILD_DIR/Ticket System/backend/"
cp backend/package-lock.json "$BUILD_DIR/Ticket System/backend/" 2>/dev/null || true
mkdir -p "$BUILD_DIR/Ticket System/backend/prisma"
cp -r backend/prisma/migrations "$BUILD_DIR/Ticket System/backend/prisma/" 2>/dev/null || true
cp backend/prisma/schema.prisma "$BUILD_DIR/Ticket System/backend/prisma/"

# Copy frontend
cp frontend/index.html "$BUILD_DIR/Ticket System/frontend/"

# Copy configs and scripts
cp docker-compose.yml "$BUILD_DIR/Ticket System/"
cp Caddyfile "$BUILD_DIR/Ticket System/" 2>/dev/null || true
cp README.md "$BUILD_DIR/Ticket System/" 2>/dev/null || true
cp .env.example "$BUILD_DIR/Ticket System/.env" 2>/dev/null || cat > "$BUILD_DIR/Ticket System/.env" << 'EOF'
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ticket_system
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticket_system
REDIS_URL=redis://localhost:6379
NODE_ENV=production
PORT=3000
EOF

# Create start script
cat > "$BUILD_DIR/Ticket System/START-SERVER.sh" << 'SCRIPT_EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Uruchamianie Ticket System..."
echo ""
echo "⚠️  Wymagania:"
echo "   - Docker Desktop (https://www.docker.com/products/docker-desktop)"
echo ""
echo "📦 Instalowanie dependencji..."
cd backend
npm install --force --silent 2>&1 | tail -3
echo ""
echo "🔄 Migracja bazy danych..."
npx prisma migrate deploy --skip-generate 2>&1 | tail -3
echo ""
echo "🚀 Uruchamianie usług..."
cd ..
docker-compose up
SCRIPT_EOF

chmod +x "$BUILD_DIR/Ticket System/START-SERVER.sh"

# Create README
cat > "$BUILD_DIR/Ticket System/README.txt" << 'README_EOF'
╔════════════════════════════════════════════════════════╗
║         Ticket System - Instalator DMG                 ║
║                  v0.1.0                                ║
╚════════════════════════════════════════════════════════╝

🎯 INSTRUKCJE INSTALACJI:
========================

1. Otwórz ten DMG i przetnij zawartość do dowolnego miejsca na dysku

2. Uruchom skrypt START-SERVER.sh:
   cd "Ticket System"
   ./START-SERVER.sh

3. Wymagania:
   - Docker Desktop (https://www.docker.com/products/docker-desktop)
   - Node.js (zostanie użyty z instalatora, jeśli dostępny)

📚 Po uruchomieniu:
   - Frontend: http://localhost:3000
   - API: http://localhost:3000/api
   - Swagger Docs: http://localhost:3000/api/docs
   - MinIO Console: http://localhost:9001 (minioadmin/minioadmin)

🔧 Struktura:
   backend/       - Node.js backend API (NestJS)
   frontend/      - Portal statyczny
   docker-compose.yml - Konfiguracja usług (Postgres, Redis, MinIO)

📖 Dokumentacja:
   README.md      - Ogólne informacje o systemie

⚠️  Ważne:
   - System wymaga docker-compose do uruchomienia
   - Pierwszy start zajmie więcej czasu (pobieranie obrazów Docker)
   - Domyślne dane dostępu usług znajdują się w pliku .env

Powodzenia! 🚀
README_EOF

# Create DMG
echo -e "${YELLOW}4. Tworzenie obrazu DMG...${NC}"

# Create temporary DMG
TEMP_DMG="/tmp/ticket-system-temp-$$.dmg"
hdiutil create -srcfolder "$BUILD_DIR" -volname "Ticket System" -fs HFS+ -fsargs "-c c=64,a=16,e=16" -format UDRW -o "$TEMP_DMG" > /dev/null 2>&1

if [ ! -f "$TEMP_DMG" ]; then
    echo -e "${RED}✗ Błąd: Nie udało się utworzyć czasowego DMG${NC}"
    exit 1
fi

# Mount and customize
echo -e "${YELLOW}5. Dostosowywanie wyglądu...${NC}"
MOUNT_POINT=$(hdiutil attach "$TEMP_DMG" 2>/dev/null | tail -1 | awk '{print $NF}')

# Set window size and icon position with AppleScript
if command -v osascript &> /dev/null; then
    osascript - "$MOUNT_POINT" << 'APPLESCRIPT_EOF' 2>/dev/null || true
on run argv
    set mountPath to item 1 of argv
    tell application "Finder"
        delay 1
        tell disk (name of disk of POSIX file mountPath)
            open
            delay 1
            tell container window
                set current view to icon view
                set toolbar visible to false
                set statusbar visible to false
                set bounds to {100, 100, 700, 500}
            end tell
            delay 1
        end tell
    end tell
end run
APPLESCRIPT_EOF
fi

sleep 2

# Unmount
hdiutil detach "$MOUNT_POINT" > /dev/null 2>&1

# Convert to compressed
echo -e "${YELLOW}6. Kompresja...${NC}"
hdiutil convert "$TEMP_DMG" -format UDBZ -o "$DMG_OUTPUT" > /dev/null 2>&1

# Cleanup temp
rm -f "$TEMP_DMG"

# Check result
if [ -f "$DMG_OUTPUT" ]; then
    DMG_SIZE=$(ls -lh "$DMG_OUTPUT" | awk '{print $5}')
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ DMG INSTALATOR ZOSTAŁ POMYŚLNIE UTWORZONY!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "📦 ${GREEN}${DMG_OUTPUT}${NC}"
    echo -e "📊 Rozmiar: ${GREEN}${DMG_SIZE}${NC}"
    echo ""
    echo -e "${YELLOW}Instrukcje:${NC}"
    echo "  1. Otwórz plik DMG"
    echo "  2. Przetnij folder 'Ticket System' do żądanej lokalizacji"
    echo "  3. Uruchom ./START-SERVER.sh"
    echo ""
    echo -e "${YELLOW}Wymagania:${NC}"
    echo "  ✓ Docker Desktop"
    echo "  ✓ Node.js (opcjonalnie - będzie użyty z systemu)"
    echo ""
else
    echo -e "${RED}✗ Błąd: DMG nie został utworzony${NC}"
    exit 1
fi

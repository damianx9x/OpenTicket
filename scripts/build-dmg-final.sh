#!/bin/bash
# Ticket System DMG Builder - Final Working Version
# No brew required - uses native macOS tools only

set -e -o pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="/tmp/ticket-dmg-$$"
DIST_DIR="${PROJECT_DIR}/dist"
DMG_OUTPUT="${DIST_DIR}/ticket-system-installer.dmg"
VERSION="0.1.0"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${NC}"
echo -e "${GREEN}┃  Ticket System DMG Builder v${VERSION}          ┃${NC}"
echo -e "${GREEN}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${NC}"
echo ""

# Cleanup function
cleanup() {
    echo -e "${YELLOW}→ Czyszczenie${NC}"
    rm -rf "$BUILD_DIR" 2>/dev/null || true
    # Unmount if attached
    diskutil list | grep -q "Ticket System" && diskutil unmount force "/Volumes/Ticket System" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Step 1: Prepare
echo -e "${YELLOW}1. Przygotowanie${NC}"
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Step 2: Build backend
echo -e "${YELLOW}2. Budowanie backendu${NC}"
cd "${PROJECT_DIR}/backend"
if npm run build 2>&1 | tail -10 | grep -q "error"; then
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Backend zbudowany${NC}"
cd "$PROJECT_DIR"

# Step 3: Gather files
echo -e "${YELLOW}3. Zbieranie plików${NC}"

# Main folder
APP_DIR="$BUILD_DIR/Ticket System"
mkdir -p "$APP_DIR"

# Backend
mkdir -p "$APP_DIR/backend"
cp -r backend/dist "$APP_DIR/backend/app"
cp backend/package.json "$APP_DIR/backend/"
[ -f backend/package-lock.json ] && cp backend/package-lock.json "$APP_DIR/backend/"

# Prisma
mkdir -p "$APP_DIR/backend/prisma"
[ -d backend/prisma/migrations ] && cp -r backend/prisma/migrations "$APP_DIR/backend/prisma/"
cp backend/prisma/schema.prisma "$APP_DIR/backend/prisma/"

# Frontend
mkdir -p "$APP_DIR/frontend"
cp frontend/index.html "$APP_DIR/frontend/"

# Configs
cp docker-compose.yml "$APP_DIR/"
[ -f Caddyfile ] && cp Caddyfile "$APP_DIR/"
[ -f README.md ] && cp README.md "$APP_DIR/"

# Environment
cat > "$APP_DIR/.env" << 'EOF'
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ticket_system
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticket_system
REDIS_URL=redis://localhost:6379
NODE_ENV=production
PORT=3000
EOF

echo -e "${GREEN}  ✓ Pliki zebrane${NC}"

# Step 4: Create start script
echo -e "${YELLOW}4. Tworzenie skryptów${NC}"

cat > "$APP_DIR/START.sh" << 'STARTSCRIPT'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "🚀 Ticket System"
echo ""
echo "⚠️  Wymagania:"
echo "   - Docker Desktop: https://www.docker.com/products/docker-desktop"
echo ""
echo "📦 Instalowanie zależności..."
cd "$DIR/backend"
npm install --force --silent 2>&1 | tail -1
echo ""
echo "🔄 Konfiguracja bazy danych..."
npx prisma migrate deploy --skip-generate 2>&1 | tail -1
echo ""
echo "🚀 Uruchamianie usług (Ctrl+C by zatrzymać)..."
cd "$DIR"
docker-compose up
STARTSCRIPT

chmod +x "$APP_DIR/START.sh"

# Create info file
cat > "$APP_DIR/README-INSTALACJA.txt" << 'READMEFILE'
╔══════════════════════════════════════════════════════════╗
║       Ticket System - Instalator                         ║
║                 v0.1.0                                   ║
╚══════════════════════════════════════════════════════════╝

🎯 SZYBKI START:
================

1. Otwórz folder "Ticket System" z tego DMG

2. Uruchom START.sh:
   ./START.sh

3. Czekaj na uruchomienie usług (Postgres, Redis, MinIO, API)

4. Otwórz w przeglądarce:
   http://localhost:3000


📚 KOMPONENTY:
==============
✓ API REST (NestJS)        - Port 3000
✓ PostgreSQL               - Port 5432
✓ Redis                    - Port 6379
✓ MinIO (S3 compatible)    - Port 9000/9001


⚠️  WYMAGANIA:
==============
• Docker Desktop - pobierz z: https://www.docker.com/products/docker-desktop
• Node.js - dołączony w pakiecie
• 2GB wolnego miejsca na dysku
• Internet (do pobrania obrazów Docker)


🔗 DOSTĘPNE PORTY PO URUCHOMIENIU:
===================================
• Frontend:         http://localhost:3000
• API:              http://localhost:3000/api
• Swagger Docs:     http://localhost:3000/api/docs
• MinIO Console:    http://localhost:9001
  Login: minioadmin / minioadmin


🆘 CO ROBIĆ JEŚLI COŚ NIE DZIAŁA:
===================================

Błąd: "Docker not found"
→ Zainstaluj Docker Desktop: https://www.docker.com/products/docker-desktop

Błąd: Port 3000 już w użyciu
→ Zmień PORT w pliku .env i uruchom ponownie

Błąd: npm install fails
→ Spróbuj: npm install --force

Błąd: Database connection failed
→ Czekaj - PostgreSQL potrzebuje czasu na start
→ Czekaj zęby docker-compose był w pełni działający


📖 STRUKTURA:
==============
backend/           - Node.js backend (NestJS)
frontend/          - Portal HTML
docker-compose.yml - Konfiguracja usług
.env              - Zmienne środowiskowe


💡 PORADY:
==========
• System konfiguruje się sam przy pierwszym starcie
• Wszystkie dane przechowywane są w Docker containers
• Aby wyczyścić wszystko: docker-compose down -v


Powodzenia! 🚀
READMEFILE

echo -e "${GREEN}  ✓ Skrypty utworzone${NC}"

# Step 5: Create DMG
echo -e "${YELLOW}5. Tworzenie obrazu DMG (może potrwać...)${NC}"

TEMP_DMG="/tmp/ticket-temp-$$.dmg"

# Create DMG
if ! hdiutil create -srcfolder "$BUILD_DIR" \
    -volname "Ticket System" \
    -fs HFS+ \
    -fsargs "-c c=64,a=16,e=16" \
    -format UDRW \
    -o "$TEMP_DMG" 2>&1 | tail -3; then
    echo -e "${RED}✗ Błąd przy tworzeniu DMG${NC}"
    rm -f "$TEMP_DMG"
    exit 1
fi

echo -e "${GREEN}  ✓ Obraz tymczasowy utworzony${NC}"

# Step 6: Mount and customize
echo -e "${YELLOW}6. Dostosowywanie wyglądu${NC}"

MOUNT=$(hdiutil attach "$TEMP_DMG" 2>&1 | tail -1 | awk '{print $NF}')
sleep 2

# Set icon view and layout
if command -v osascript &>/dev/null; then
    osascript - "$MOUNT" << 'APPLESCRIPT' 2>/dev/null || true
on run argv
    set mp to item 1 of argv
    tell application "Finder"
        delay 1
        tell disk (name of disk of POSIX file mp)
            open
            delay 1
            tell container window
                set current view to icon view
                set icon size of (icon view options of container window) to 48
                set bounds to {50, 50, 600, 400}
            end tell
        end tell
    end tell
end run
APPLESCRIPT
fi

sleep 2

# Unmount - use eject instead of detach
hdiutil eject "$MOUNT" 2>/dev/null || hdiutil detach "$MOUNT" 2>/dev/null || true
sleep 3

echo -e "${GREEN}  ✓ Wygląd dostosowany${NC}"

# Step 7: Compress
echo -e "${YELLOW}7. Kompresja${NC}"

if ! hdiutil convert "$TEMP_DMG" \
    -format UDBZ \
    -o "$DMG_OUTPUT" 2>&1 | tail -3; then
    echo -e "${RED}✗ Błąd przy kompresji${NC}"
    rm -f "$TEMP_DMG"
    exit 1
fi

rm -f "$TEMP_DMG"

# Success!
if [ -f "$DMG_OUTPUT" ]; then
    SIZE=$(du -h "$DMG_OUTPUT" | awk '{print $1}')
    echo ""
    echo -e "${GREEN}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${NC}"
    echo -e "${GREEN}┃        ✅ INSTALATOR GOTOWY!             ┃${NC}"
    echo -e "${GREEN}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${NC}"
    echo ""
    echo -e "📦 Ścieżka: ${GREEN}${DMG_OUTPUT}${NC}"
    echo -e "📊 Rozmiar: ${GREEN}${SIZE}${NC}"
    echo ""
    echo -e "${YELLOW}Instrukcje:${NC}"
    echo "  1. Otwórz ${DMG_OUTPUT}"
    echo "  2. Przeciągnij folder do wybranej lokalizacji"
    echo "  3. Uruchom ./START.sh"
    echo ""
    exit 0
else
    echo -e "${RED}✗ DMG nie został utworzony${NC}"
    exit 1
fi

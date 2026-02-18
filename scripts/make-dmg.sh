#!/bin/bash
# Ticket System DMG Builder - Simplified (no AppleScript)

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="/tmp/ticket-dmg-$$"
DIST_DIR="${PROJECT_DIR}/dist"
DMG_OUTPUT="${DIST_DIR}/ticket-system-installer.dmg"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🔨 Ticket System DMG Builder${NC}\n"

cleanup() {
    rm -rf "$BUILD_DIR" 2>/dev/null || true
}
trap cleanup EXIT

# 1. Prepare
echo -e "${YELLOW}✓ Preparing...${NC}"
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR/Ticket System" "$DIST_DIR"

# 2. Build backend
echo -e "${YELLOW}✓ Building backend...${NC}"
cd "${PROJECT_DIR}/backend"
npm install --legacy-peer-deps
npm run build
if [ ! -f "dist/main.js" ]; then
    echo -e "${RED}❌ Error: Build failed - dist/main.js missing${NC}"
    exit 1
fi
cd "$PROJECT_DIR"

# 3. Gather files
echo -e "${YELLOW}✓ Gathering files...${NC}"
APP_DIR="$BUILD_DIR/Ticket System"

# Backend
mkdir -p "$APP_DIR/backend"
cp -r backend/dist "$APP_DIR/backend/"
cp backend/package.json "$APP_DIR/backend/"
[ -f backend/package-lock.json ] && cp backend/package-lock.json "$APP_DIR/backend/"
mkdir -p "$APP_DIR/backend/prisma"
cp -r backend/prisma/migrations "$APP_DIR/backend/prisma/" 2>/dev/null || true
cp backend/prisma/schema.prisma "$APP_DIR/backend/prisma/"

# Frontend
mkdir -p "$APP_DIR/frontend"
cp -rf "$APP_DIR/frontend/node_modules" "$APP_DIR/frontend/.next"

# Caddyfile
[ -f Caddyfile ] && cp Caddyfile "$APP_DIR/"
[ -f README.md ] && cp README.md "$APP_DIR/"

# Create special docker-compose.yml for installer (uses prebuilt backend, doesn't build)
cat > "$APP_DIR/docker-compose.yml" << 'COMPOSE'
services:
  postgres:
    image: postgres:15-alpine
    container_name: ticket_system_postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-ticket_system}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: ticket_system_redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    container_name: ticket_system_minio
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  backend:
    image: node:20-alpine
    container_name: ticket_system_backend
    working_dir: /app/backend
    command: sh -c "apk add --no-cache openssl && npm install --legacy-peer-deps --include=dev --no-save && npx prisma generate && npx prisma migrate deploy && npm start"
    ports:
      - "3001:3001"
    volumes:
      - ./backend:/app/backend
      - /app/backend/node_modules
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/ticket_system
      REDIS_URL: redis://redis:6379
      PORT: 3001
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    image: node:20-alpine
    container_name: ticket_system_frontend
    working_dir: /app/frontend
    command: sh -c "npm install && npm run build && npm start"
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app/frontend
      - /app/frontend/node_modules
      - /app/frontend/.next
    environment:
      NODE_ENV: production
    env_file:
      - .env
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  minio_data:
COMPOSE

# Environment
cat > "$APP_DIR/.env" << 'ENV'
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ticket_system
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticket_system
REDIS_URL=redis://localhost:6379
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
NODE_ENV=production
PORT=3001
ENV
# START script
cat > "$APP_DIR/START.sh" << 'SCRIPT'
#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
echo "🚀 Ticket System - Starting..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ BŁĄD: Docker nie jest zainstalowany!"
    echo ""
    echo "📥 Kroki instalacji:"
    echo "  1. Pobierz Docker Desktop:"
    echo "     https://www.docker.com/products/docker-desktop"
    echo ""
    echo "  2. Zainstaluj:"
    echo "     - Otwórz pobrany plik .dmg"
    echo "     - Przeciągnij Docker do Applications"
    echo ""
    echo "  3. Uruchom Docker:"
    echo "     - Otwórz Applications → Docker"
    echo "     - Poczekaj na pojawienie się ikony wieloryba w menu górnym"
    echo ""
    echo "  4. Sprawdź instalację w Terminalu:"
    echo "     docker --version"
    echo ""
    echo "  5. Uruchom ponownie ten skrypt"
    echo ""
    exit 1
fi

# Check if docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ BŁĄD: Docker nie jest uruchomiony!"
    echo ""
    echo "  Uruchom Docker Desktop:"
    echo "    Applications → Docker"
    echo ""
    echo "  Lub uruchom z Terminala:"
    echo "    open -a Docker"
    echo ""
    echo "  Poczekaj aż Docker się uruchomi, potem spróbuj ponownie."
    echo ""
    exit 1
fi

cd "$DIR"

echo "📦 Uruchamianie usług..."
echo "   Pobieranie obrazów Docker (może potrwać kilka minut przy pierwszym starcie)..."
echo ""
echo "✅ Usługi które będą dostępne:"
echo "   • Frontend:     http://localhost:3000"
echo "   • API:          http://localhost:3000/api"
echo "   • Docs Swagger: http://localhost:3000/api/docs"
echo "   • MinIO:        http://localhost:9001"
echo ""
echo "⏹️  Aby zatrzymać: Ctrl+C"
echo ""

# Use 'docker compose' (new) or 'docker-compose' (legacy)
if command -v docker-compose &> /dev/null; then
    exec docker-compose up
else
    exec docker compose up
fi
SCRIPT
chmod +x "$APP_DIR/START.sh"

# README
cat > "$APP_DIR/INSTALACJA.txt" << 'README'
╔════════════════════════════════════════════╗
║  Ticket System - Quick Start               ║
╚════════════════════════════════════════════╝

1. Run: ./START.sh
2. Open: http://localhost:3000

Requirements:
- Docker Desktop

Enjoy! 🚀
README

# 4. Create DMG
echo -e "${YELLOW}✓ Creating DMG image...${NC}"
TEMP_DMG="/tmp/ticket-temp-$$.dmg"

hdiutil create -srcfolder "$BUILD_DIR" \
    -volname "Ticket System" \
    -fs HFS+ \
    -format UDRW \
    -o "$TEMP_DMG"

echo -e "${YELLOW}✓ Compressing...${NC}"
hdiutil convert "$TEMP_DMG" \
    -format UDBZ \
    -o "$DMG_OUTPUT"

rm -f "$TEMP_DMG"

# Success
if [ -f "$DMG_OUTPUT" ]; then
    SIZE=$(du -h "$DMG_OUTPUT" | awk '{print $1}')
    echo -e "\n${GREEN}✅ SUCCESS!${NC}"
    echo -e "🎉 DMG created: ${DMG_OUTPUT}"
    echo -e "📊 Size: ${SIZE}\n"
else
    echo -e "${RED}✗ Failed to create DMG${NC}"
    exit 1
fi

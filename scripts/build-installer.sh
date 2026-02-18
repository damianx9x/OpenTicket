#!/bin/bash
# Native DMG Builder - Minimalistyczna wersja
# Tworzy DMG bez brew, tylko z natywnych narzędzi macOS

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Ticket System - DMG Builder${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Sprawdzenie wymagań
echo -e "${YELLOW}✓ Sprawdzanie wymagań...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js nie zainstalowany${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm nie zainstalowany${NC}"
    exit 1
fi

if ! command -v hdiutil &> /dev/null; then
    echo -e "${RED}✗ hdiutil niedostępny (macOS tools)${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker nie zainstalowany - będzie wymagany podczas instalacji${NC}"
fi

echo -e "${GREEN}✓ Wszystkie wymagania spełnione${NC}"
echo ""

# Changelog
echo -e "${YELLOW}Kroki budowania:${NC}"
echo "  1. Budowa backendu (TypeScript → JavaScript)"
echo "  2. Pakowanie aplikacji"
echo "  3. Tworzenie struktury DMG"
echo "  4. Kompresja i finalizacja"
echo ""

# Build backend
echo -e "${YELLOW}→ Budowanie backendu...${NC}"
cd backend
npm run build 2>&1 | tail -3
cd ..

# Make build-dmg.sh executable and run it
echo ""
echo -e "${YELLOW}→ Uruchamianie builder DMG...${NC}"
chmod +x scripts/build-dmg.sh
exec scripts/build-dmg.sh

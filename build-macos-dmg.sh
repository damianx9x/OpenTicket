#!/bin/bash

# Regenerate DMG installer with fixed backend spawning

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Building Complete Ticket System DMG Installer                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Backend dependencies
echo -e "${YELLOW}[1/6]${NC} Installing backend production dependencies..."
cd "$PROJECT_DIR/backend"
[ ! -d "node_modules" ] && npm install --production || echo "Already installed"
npm run build > /dev/null 2>&1
echo -e "${GREEN}✓ Backend ready${NC}"
cd "$PROJECT_DIR"
echo ""

# Step 2: Frontend
echo -e "${YELLOW}[2/6]${NC} Building Next.js Frontend..."
cd "$PROJECT_DIR/frontend"
npm run build > /dev/null 2>&1
echo -e "${GREEN}✓ Frontend built${NC}"
cd "$PROJECT_DIR"
echo ""

# Step 3: Desktop Electron
echo -e "${YELLOW}[3/6]${NC} Building Electron main process..."
cd "$PROJECT_DIR/desktop"
npm run build:electron > /dev/null 2>&1
echo -e "${GREEN}✓ Electron compiled${NC}"
echo ""

# Step 4: Clean previous builds
echo -e "${YELLOW}[4/6]${NC} Cleaning previous builds..."
rm -rf "$PROJECT_DIR/desktop/release/"
echo -e "${GREEN}✓ Cleaned${NC}"
echo ""

# Step 5: Create DMG
echo -e "${YELLOW}[5/6]${NC} Creating DMG package (this takes a minute)..."
npm run dist:mac > /dev/null 2>&1 || npm run dist:mac

# Verify DMG was created
DMG_FILE=$(find "$PROJECT_DIR/desktop/release" -name "*.dmg" -type f 2>/dev/null | head -1)
if [ ! -f "$DMG_FILE" ]; then
    echo -e "${RED}✗ Build failed - DMG not found${NC}"
    exit 1
fi

DMG_SIZE=$(du -h "$DMG_FILE" | cut -f1)
cd "$PROJECT_DIR"
echo -e "${GREEN}✓ DMG created (Size: $DMG_SIZE)${NC}"
echo ""

# Step 6: Copy to final
echo -e "${YELLOW}[6/6]${NC} Deploying to final/MacOS..."
mkdir -p "$PROJECT_DIR/final/MacOS"
cp "$DMG_FILE" "$PROJECT_DIR/final/MacOS/ticket-system-installer.dmg"
echo -e "${GREEN}✓ Deployed${NC}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  BUILD SUCCESS!                                ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║  📦 Ready: final/MacOS/ticket-system-installer.dmg             ║${NC}"
echo -e "${BLUE}║  📊 Size:  $DMG_SIZE                                                   ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║  To install:                                                   ║${NC}"
echo -e "${BLUE}║    1. hdiutil attach final/MacOS/ticket-system-installer.dmg   ║${NC}"
echo -e "${BLUE}║    2. cp -r '/Volumes/Ticket System/Ticket System.app'         ║${NC}"
echo -e "${BLUE}║       /Applications/                                            ║${NC}"
echo -e "${BLUE}║    3. open /Applications/Ticket\ System.app                    ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

#!/bin/bash

# macOS DMG Installer Builder
# Builds complete Ticket System with NestJS backend + Next.js frontend embedded in Electron

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Ticket System macOS DMG Builder                         ║${NC}"
echo -e "${BLUE}║        Building self-contained app with no Docker required    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}[1/6]${NC} Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not installed${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not installed${NC}"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm ${NPM_VERSION}${NC}"

echo ""

# Step 2: Build Backend
echo -e "${YELLOW}[2/6]${NC} Building NestJS Backend..."
cd "$PROJECT_DIR/backend"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  → Installing backend dependencies...${NC}"
    npm install
fi
echo -e "${YELLOW}  → Compiling TypeScript...${NC}"
npm run build
echo -e "${GREEN}✓ Backend built${NC}"
echo ""

# Step 3: Build Frontend
echo -e "${YELLOW}[3/6]${NC} Building Next.js Frontend..."
cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  → Installing frontend dependencies...${NC}"
    npm install
fi
echo -e "${YELLOW}  → Building Next.js...${NC}"
npm run build
echo -e "${GREEN}✓ Frontend built${NC}"
echo ""

# Step 4: Install Desktop Dependencies
echo -e "${YELLOW}[4/6]${NC} Installing Electron dependencies..."
cd "$PROJECT_DIR/desktop"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  → Installing desktop dependencies...${NC}"
    npm install
fi
echo -e "${GREEN}✓ Electron dependencies ready${NC}"
echo ""

# Step 5: Build Electron Main Process
echo -e "${YELLOW}[5/6]${NC} Building Electron main process..."
echo -e "${YELLOW}  → Compiling TypeScript...${NC}"
npm run build:electron
echo -e "${GREEN}✓ Electron compiled${NC}"
echo ""

# Step 6: Create DMG Package
echo -e "${YELLOW}[6/6]${NC} Creating DMG installer..."
echo -e "${YELLOW}  → Running electron-builder...${NC}"
npm run dist:mac

# Check result
if [ $? -eq 0 ]; then
    DMG_FILE=$(find "$PROJECT_DIR/desktop/release" -name "*.dmg" -type f 2>/dev/null | head -1)
    if [ -n "$DMG_FILE" ]; then
        DMG_SIZE=$(du -h "$DMG_FILE" | cut -f1)
        echo -e "${GREEN}✓ DMG created successfully${NC}"
        echo -e "${GREEN}  📦 File: $DMG_FILE${NC}"
        echo -e "${GREEN}  📊 Size: $DMG_SIZE${NC}"
        echo ""
        echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║                  BUILD COMPLETED SUCCESSFULLY                  ║${NC}"
        echo -e "${BLUE}║                                                                ║${NC}"
        echo -e "${BLUE}║  Next steps:                                                   ║${NC}"
        echo -e "${BLUE}║  1. Open the DMG file to install                              ║${NC}"
        echo -e "${BLUE}║  2. Drag the app to Applications folder                       ║${NC}"
        echo -e "${BLUE}║  3. Launch from Applications (may require Cmd+Space search)   ║${NC}"
        echo -e "${BLUE}║                                                                ║${NC}"
        echo -e "${BLUE}║  First launch will show setup wizard                           ║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
        
        # Copy to final/MacOS
        echo ""
        echo -e "${YELLOW}Copying DMG to final/MacOS directory...${NC}"
        mkdir -p "$PROJECT_DIR/final/MacOS"
        cp "$DMG_FILE" "$PROJECT_DIR/final/MacOS/ticket-system-installer.dmg"
        echo -e "${GREEN}✓ Copied to final/MacOS/ticket-system-installer.dmg${NC}"
    else
        echo -e "${RED}✗ DMG file not found after build${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

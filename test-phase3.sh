#!/bin/bash
# Test script for PHASE 3 Electron wrapper

set -e

echo "🧪 TEST 3: Electron Wrapper Verification"
echo "======================================="

# Check file structure
echo "✓ Checking file structure..."
files=(
  "desktop/main.ts"
  "desktop/preload.ts"
  "desktop/package.json"
  "desktop/tsconfig.json"
  "desktop/README.md"
  "frontend/electron.d.ts"
  "backend/src/main.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ MISSING: $file"
    exit 1
  fi
done

# Install dependencies if needed
echo ""
echo "✓ Installing dependencies..."
if [ ! -d "desktop/node_modules" ]; then
  cd desktop
  npm install
  cd ..
fi

# Compile TypeScript
echo ""
echo "✓ Compiling desktop TypeScript..."
cd desktop
npm run build:electron
if [ -f "dist/main.js" ]; then
  echo "  ✓ main.js compiled successfully"
else
  echo "  ✗ main.js not compiled"
  exit 1
fi

if [ -f "dist/preload.js" ]; then
  echo "  ✓ preload.js compiled successfully"
else
  echo "  ✗ preload.js not compiled"
  exit 1
fi
cd ..

# Verify imports
echo ""
echo "✓ Checking TypeScript errors..."
cd desktop
# Count compilation errors
errors=$(tsc --noEmit 2>&1 | grep -c "error TS" || true)
if [ "$errors" -eq 0 ]; then
  echo "  ✓ No TypeScript errors"
else
  echo "  ✗ Found $errors TypeScript errors"
  tsc --noEmit
  exit 1
fi
cd ..

# Check backend compilation
echo ""
echo "✓ Checking backend compilation..."
if [ -f "backend/dist/main.js" ]; then
  echo "  ✓ backend/dist/main.js exists"
else
  echo "  ✗ backend/dist/main.js not found - run: cd backend && npm run build"
fi

# Check frontend build
echo ""
echo "✓ Checking frontend build..."
if [ -f "frontend/out/index.html" ]; then
  echo "  ✓ frontend/out/index.html exists"
else
  echo "  ⚠ frontend/out/index.html not found - run: cd frontend && npm run build"
fi

# Check core functionality in code
echo ""
echo "✓ Verifying core functionality..."

# Check if main.ts has backend spawning logic
if grep -q "spawnBackend" "desktop/main.ts"; then
  echo "  ✓ Backend spawning logic found"
else
  echo "  ✗ Backend spawning logic missing"
  exit 1
fi

# Check if preload.ts has IPC methods
if grep -q "getLocalIp" "desktop/preload.ts"; then
  echo "  ✓ IPC getLocalIp method found"
else
  echo "  ✗ IPC getLocalIp method missing"
  exit 1
fi

if grep -q "selectFolder" "desktop/preload.ts"; then
  echo "  ✓ IPC selectFolder method found"
else
  echo "  ✗ IPC selectFolder method missing"
  exit 1
fi

# Check if app.module.ts serves static frontend
if grep -q "ServeStaticModule" "backend/src/app.module.ts"; then
  echo "  ✓ ServeStaticModule configured in backend"
else
  echo "  ✗ ServeStaticModule not found in backend"
  exit 1
fi

# Check if Step1 has electron.selectFolder
if grep -q "electron.selectFolder" "frontend/app/components/steps/Step1-Location.tsx"; then
  echo "  ✓ Step1 supports electron.selectFolder"
else
  echo "  ✗ Step1 missing electron.selectFolder support"
  exit 1
fi

# Check if Step4 has electron.getLocalIp
if grep -q "electron.getLocalIp" "frontend/app/components/steps/Step4-QRCode.tsx"; then
  echo "  ✓ Step4 supports electron.getLocalIp"
else
  echo "  ✗ Step4 missing electron.getLocalIp support"
  exit 1
fi

echo ""
echo "✅ TEST 3 PASSED: Electron wrapper ready for building"
echo ""
echo "Next steps:"
echo "  1. npm install (in root, backend, frontend, desktop)"
echo "  2. npm run build (compile all components)"
echo "  3. cd desktop && npm run dist:mac (build DMG)"
echo ""

# Test script for PHASE 3 Electron wrapper (PowerShell)

Write-Host "[TEST 3] Electron Wrapper Verification" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$errors = 0

# Check file structure
Write-Host "Checking file structure..." -ForegroundColor Green
$files = @(
  "desktop\main.ts",
  "desktop\preload.ts",
  "desktop\package.json",
  "desktop\tsconfig.json",
  "desktop\README.md",
  "frontend\electron.d.ts",
  "backend\src\main.ts"
)

foreach ($file in $files) {
  if (Test-Path $file) {
    Write-Host "  [OK] $file" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] MISSING: $file" -ForegroundColor Red
    $errors = $errors + 1
  }
}

if ($errors -gt 0) {
  Write-Host ""
  Write-Host "[ABORT] Missing files." -ForegroundColor Red
  exit 1
}

# Check if node_modules exist in desktop
Write-Host ""
Write-Host "Checking dependencies..." -ForegroundColor Green
$hasDesktopModules = Test-Path "desktop\node_modules"
if ($hasDesktopModules) {
  Write-Host "  [OK] Desktop dependencies installed" -ForegroundColor Green
} else {
  Write-Host "  [WARN] Desktop dependencies not installed yet (run: cd desktop; npm install)" -ForegroundColor Yellow
}

# Check for compiled output (without running npm)
Write-Host ""
Write-Host "Checking TypeScript compilation status..." -ForegroundColor Green
$hasCompiledCode = Test-Path "desktop\dist"
if ($hasCompiledCode -and $hasDesktopModules) {
  Write-Host "  [OK] Previously compiled" -ForegroundColor Green
} else {
  Write-Host "  [INFO] Not yet compiled (will compile during build phase)" -ForegroundColor Yellow
}

# Check backend compilation
Write-Host ""
Write-Host "Checking backend..." -ForegroundColor Green
if (Test-Path "backend\dist\main.js") {
  Write-Host "  [OK] backend/dist/main.js exists" -ForegroundColor Green
} else {
  Write-Host "  [WARN] backend/dist/main.js not found - run: cd backend; npm run build" -ForegroundColor Yellow
}

# Check frontend build
Write-Host ""
Write-Host "Checking frontend..." -ForegroundColor Green
if (Test-Path "frontend\out\index.html") {
  Write-Host "  [OK] frontend/out/index.html exists" -ForegroundColor Green
} else {
  Write-Host "  [WARN] frontend/out/index.html not found - run: cd frontend; npm run build" -ForegroundColor Yellow
}

# Verify core functionality
Write-Host ""
Write-Host "Verifying implementation..." -ForegroundColor Green

$checks = @(
  @{ file = "desktop\main.ts"; search = "spawnBackend"; name = "Backend spawning" },
  @{ file = "desktop\preload.ts"; search = "getLocalIp"; name = "IPC getLocalIp" },
  @{ file = "desktop\preload.ts"; search = "selectFolder"; name = "IPC selectFolder" },
  @{ file = "backend\src\app.module.ts"; search = "ServeStaticModule"; name = "Static frontend serving" },
  @{ file = "frontend\app\components\steps\Step1-Location.tsx"; search = "electron.selectFolder"; name = "Step1 folder picker" },
  @{ file = "frontend\app\components\steps\Step4-QRCode.tsx"; search = "electron.getLocalIp"; name = "Step4 IP detection" }
)

foreach ($check in $checks) {
  $content = Get-Content $check.file -Raw
  if ($content -match $check.search) {
    Write-Host "  [OK] $($check.name)" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] $($check.name) - missing" -ForegroundColor Red
    $errors = $errors + 1
  }
}

Write-Host ""
if ($errors -eq 0) {
  Write-Host "[SUCCESS] TEST 3 PASSED: Electron wrapper ready for building" -ForegroundColor Green
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor Cyan
  Write-Host "  1. npm install (in root, backend, frontend, desktop)" -ForegroundColor Gray
  Write-Host "  2. npm run build (compile all components)" -ForegroundColor Gray
  Write-Host "  3. cd desktop; npm run dist:mac (build DMG)" -ForegroundColor Gray
  Write-Host ""
} else {
  Write-Host "[FAILURE] TEST 3 FAILED with $errors error(s)" -ForegroundColor Red
  exit 1
}

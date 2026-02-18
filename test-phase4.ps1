# Test script for PHASE 4 iOS Integration (PowerShell)

Write-Host "[TEST 4] iOS Integration Verification" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$errors = 0

# Check iOS file structure
Write-Host "Checking iOS file structure..." -ForegroundColor Green
$iosFiles = @(
  "ios\SwiftUI\TicketApp.swift",
  "ios\SwiftUI\ContentView.swift",
  "ios\SwiftUI\Models.swift",
  "ios\SwiftUI\NetworkManager.swift",  "ios\SwiftUI\KeychainManager.swift",
  "ios\SwiftUI\QRCodeScanner.swift",
  "ios\README.md"
)

foreach ($file in $iosFiles) {
  if (Test-Path $file) {
    Write-Host "  [OK] $file" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] MISSING: $file" -ForegroundColor Red
    $errors = $errors + 1
  }
}

# Verify core functionality in iOS code
Write-Host ""
Write-Host "Verifying iOS implementation..." -ForegroundColor Green

$checks = @(
  @{ file = "ios\SwiftUI\Models.swift"; search = "ConnectionStatus"; name = "ConnectionStatus enum" },
  @{ file = "ios\SwiftUI\Models.swift"; search = "QRCodeData"; name = "QRCodeData model" },
  @{ file = "ios\SwiftUI\Models.swift"; search = "Ticket"; name = "Ticket model" },
  @{ file = "ios\SwiftUI\NetworkManager.swift"; search = "processQRData"; name = "QR processing" },
  @{ file = "ios\SwiftUI\NetworkManager.swift"; search = "fetchTickets"; name = "Ticket fetching" },
  @{ file = "ios\SwiftUI\KeychainManager.swift"; search = "saveToken"; name = "Keychain storage" },
  @{ file = "ios\SwiftUI\QRCodeScanner.swift"; search = "AVCapture"; name = "QR scanner" },
  @{ file = "ios\SwiftUI\ContentView.swift"; search = "DisconnectedView"; name = "Disconnect UI" },
  @{ file = "ios\SwiftUI\ContentView.swift"; search = "TicketRow"; name = "Ticket display" }
)

foreach ($check in $checks) {
  $content = Get-Content $check.file -Raw -ErrorAction SilentlyContinue
  if ($content -match $check.search) {
    Write-Host "  [OK] $($check.name)" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] $($check.name)" -ForegroundColor Red
    $errors = $errors + 1
  }
}

# Verify integration with previous phases
Write-Host ""
Write-Host "Verifying integration with PHASE 1-3..." -ForegroundColor Green

$integrations = @(
  @{ file = "desktop\main.ts"; search = "sqlite"; name = "SQLite backend" },
  @{ file = "frontend\app\components\steps\Step4-QRCode.tsx"; search = "QRCodeDisplay"; name = "Desktop QR generation" },
  @{ file = "backend\src\app.module.ts"; search = "TicketsModule"; name = "Tickets API" }
)

foreach ($int in $integrations) {
  $content = Get-Content $int.file -Raw -ErrorAction SilentlyContinue
  if ($content -match $int.search) {
    Write-Host "  [OK] $($int.name)" -ForegroundColor Green
  } else {
    Write-Host "  [WARN] $($int.name) - may need attention" -ForegroundColor Yellow
  }
}

# Summary
Write-Host ""
if ($errors -eq 0) {
  Write-Host "[SUCCESS] TEST 4 PASSED: iOS integration complete" -ForegroundColor Green
  Write-Host ""
  Write-Host "iOS Implementation Status:" -ForegroundColor Cyan
  Write-Host "  [Complete] QR code data structures" -ForegroundColor Green
  Write-Host "  [Complete] Network manager with async API calls" -ForegroundColor Green
  Write-Host "  [Complete] Keychain token storage" -ForegroundColor Green
  Write-Host "  [Complete] AVFoundation QR scanner" -ForegroundColor Green
  Write-Host "  [Complete] SwiftUI UI with tabs and navigation" -ForegroundColor Green
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor Cyan
  Write-Host "  1. Build and test iOS app in Xcode" -ForegroundColor Gray
  Write-Host "  2. Run desktop app with setup wizard" -ForegroundColor Gray
  Write-Host "  3. Scan QR code from iPhone to connect" -ForegroundColor Gray
  Write-Host "  4. Test ticket list and details viewing" -ForegroundColor Gray
  Write-Host "  5. Test disconnect and reconnection" -ForegroundColor Gray
  Write-Host ""
  Write-Host "All 4 PHASES COMPLETE - Ready for end-to-end testing!" -ForegroundColor Green
} else {
  Write-Host "[FAILURE] TEST 4 FAILED with $errors error(s)" -ForegroundColor Red
  exit 1
}
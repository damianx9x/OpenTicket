# Build & Compile Instructions

## macOS App (Apple Service Ticketing)

### Option 1: Using Pre-built DMG (Simplest)
```bash
# Just download and install
open final/MacOS/ticket-system-installer.dmg
# → Drag to Applications
# → Run from Launchpad
```

### Option 2: Build Standalone DMG (Interactive Configuration)

**Requirements:**
- macOS 10.14+
- No dependencies! (Uses native macOS tools only)

**Build Command:**
```bash
cd "Projekt systemu ticketowego"
bash scripts/build-macos-interactive.sh
```

**What it does:**
1. Asks for backend URL (localhost:3000 / custom / none)
2. Asks for database path (default ~/Library/Application Support/...)
3. Asks for data folder (default ~/Documents/Apple Service Data)
4. Creates standalone macOS app bundle (Apple Service.app)
5. Packages into DMG installer
6. Output: `dist/ticket-system-installer.dmg` and `final/MacOS/ticket-system-installer.dmg`

**Features:**
- ✅ Zero external dependencies
- ✅ Uses WebUI (HTML offline)
- ✅ Configurable backend URL
- ✅ Custom database path selection
- ✅ Auto-creates config files on first launch
- ✅ Works 10.14+

---

### Option 3: Manual DMG Creation (Fast)

**If you want to build quickly without prompts:**

```bash
PROJECT_DIR="$(pwd)"
BUILD_DIR="/tmp/app-$$"
mkdir -p "$BUILD_DIR/Apple Service.app/Contents/{MacOS,Resources}"

# Create launcher
cat > "$BUILD_DIR/Apple Service.app/Contents/MacOS/run" << 'EOF'
#!/bin/bash
open "$(cd "$(dirname "$0")/../Resources" && pwd)/app.html"
EOF
chmod +x "$BUILD_DIR/Apple Service.app/Contents/MacOS/run"

# Copy WebUI
cp demo-full.html "$BUILD_DIR/Apple Service.app/Contents/Resources/app.html"

# Create Info.plist
cat > "$BUILD_DIR/Apple Service.app/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict><key>CFBundleExecutable</key><string>run</string><key>CFBundleIdentifier</key><string>local.applservice.ticketing</string><key>CFBundleName</key><string>Apple Service</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>LSMinimumSystemVersion</key><string>10.14</string></dict>
</plist>
EOF

# Create DMG
hdiutil create -srcfolder "$BUILD_DIR" -volname "Apple Service" -format UDZO -o dist/ticket-system-installer.dmg
cp dist/ticket-system-installer.dmg final/MacOS/

echo "✓ DMG created: dist/ticket-system-installer.dmg"
```

---

## iOS App

### Building in Xcode

```bash
# 1. Open Xcode project
open final/ios/TicketApp.xcodeproj

# 2. Select simulator or device
# Product → Destination → Choose device

# 3. Build & Run
# Cmd + R

# Or from command line:
xcodebuild -scheme TicketApp -destination 'generic/platform=iOS' build
```

### Deployment to App Store

```bash
# Create archive
xcodebuild archive -scheme TicketApp \
    -archivePath ./build/TicketApp.xcarchive

# Upload (requires Apple Developer Account)
xcodebuild -exportArchive \
    -archivePath ./build/TicketApp.xcarchive \
    -exportPath ./ipa \
    -exportOptionsPlist exportOptions.plist
```

---

## WebUI (No Build Required!)

The WebUI is **standalone** - no build process needed:

```bash
# 1. Use directly
open final/final/index.html

# 2. Or serve on web
cd final/final
python3 -m http.server 8000
# → Open http://localhost:8000

# 3. Or deploy to production
cp final/final/index.html /var/www/app/
```

**All features work offline in a single HTML file (46 KB)**

---

## Backend (Optional)

If you want to integrate with a real backend:

```bash
# Build NestJS backend
cd backend
npm install
npm run build
npm run start

# Backend will run on http://localhost:3000
# Update WebUI config to point to this URL
```

---

## Summary

| Platform | Build Time | Size | Complexity |
|----------|-----------|------|-----------|
| **WebUI** | None | 46 KB | ✅ Zero |
| **macOS DMG** | 30 sec | 167 KB | ✅ Simple |
| **iOS** | 2-5 min | ~100 MB | ⚠️ Requires Xcode |
| **Backend** | 1 min | ~50 MB | ⚠️ Requires Docker |

---

## Troubleshooting

### Can't open DMG
```bash
xattr -d com.apple.quarantine ./ticket-system-installer.dmg
```

### DMG won't mount
```bash
# Check if already mounted
diskutil list | grep "Apple Service"
# Unmount if stuck
diskutil unmount force "/Volumes/Apple Service"
```

### App doesn't launch
- Check WebUI file exists: `ls -la "Apple Service.app/Contents/Resources/app.html"`
- Check permissions: `ls -la "Apple Service.app/Contents/MacOS/run"`
- Try rebuilding: `bash scripts/build-macos-interactive.sh`

---

**Last Updated:** 16.02.2026

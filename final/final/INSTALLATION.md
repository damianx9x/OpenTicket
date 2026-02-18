# Installation Guide

## Apple Service Ticketing System v1.0.0

**Choose your platform:**

---

## 🌐 **Option 1: WebUI (Recommended - Fastest)**

### Requirements
- Modern web browser (Chrome, Safari, Firefox, Edge)
- 50 MB disk space
- Internet connection (optional - works offline)

### Step-by-step

#### Method A: Direct File Opening
```bash
# macOS
open index.html

# Windows
double-click index.html

# Linux
firefox index.html
```

#### Method B: Local Web Server
```bash
# Using Python (included with macOS/Linux)
cd /path/to/app
python3 -m http.server 8000

# Open in browser: http://localhost:8000
```

#### Method C: Production Web Server
```bash
# Copy to your web server
scp index.html user@webserver:/var/www/ticketing/

# Access via: https://ticketing.yourdomain.com
```

**⏱️ Time to load:** < 1 second  
**📦 Size on disk:** 46 KB

---

## 🍎 **Option 2: macOS Desktop Application**

### Requirements
- macOS 10.14 or later
- 150 MB disk space
- Admin privileges for installation

### Installation Steps

**1. Mount the DMG**
```bash
open ticket-system-installer.dmg
```

**2. Drag to Applications**
- Locate the installer window
- Drag "Apple Service" icon to the Applications folder

**3. Launch the App**
```bash
# Method 1: From Applications folder
open /Applications/Apple\ Service.app

# Method 2: Using Spotlight (Cmd+Space)
# Type: Apple Service
# Press: Enter

# Method 3: From Dock (after first launch)
# Click the Dock icon
```

### First Launch

If you see: **"Cannot open Apple Service.app because it is from an unidentified developer"**

Fix it:
```bash
# Option 1: Allow in System Preferences
# System Preferences → Security & Privacy → Allow Apple Service

# Option 2: Command line bypass
xattr -d com.apple.quarantine /Applications/Apple\ Service.app
sudo spctl --add /Applications/Apple\ Service.app
```

### Uninstall
```bash
# Simple: Drag from Applications to Trash
# Complete removal:
rm -rf /Applications/Apple\ Service.app
rm -rf ~/Library/Application\ Support/Apple\ Service/
rm -rf ~/Library/Caches/Apple\ Service/
```

---

## 📱 **Option 3: iOS Mobile Application**

### Requirements
- iPhone/iPad with iOS 15.0 or later
- Xcode 14.0+ (for development/compilation)
- 200 MB disk space
- Apple Developer Account (for App Store distribution)

### Option A: Development Build (Local)

```bash
# 1. Open Xcode
open Apple\ Service.xcodeproj

# 2. Select target device/simulator
# Project → Select simulator or connected device

# 3. Build & Run
# Product → Run
# Or: Cmd+R

# 4. App launches on device/simulator
```

### Option B: TestFlight Distribution

```bash
# 1. Build for TestFlight
xcodebuild archive \
  -scheme TicketApp \
  -configuration Release \
  -derivedDataPath ./build

# 2. Upload to App Store Connect
xcrun altool --upload-app \
  --type ios \
  --file ./build/DistributionSummary.plist \
  --username "apple@applservice.local"

# 3. Users install via TestFlight app
```

### Option C: App Store Submission

```bash
# 1. Prepare for submission
# - Update version number
# - Add release notes
# - Capture screenshots
# - Write app description

# 2. Submit via App Store Connect
# https://appstoreconnect.apple.com/

# 3. Apple reviews (typically 24-48 hours)

# 4. Available on App Store
```

### First Launch on Device

If app doesn't run:

```bash
# 1. Check iOS version
Settings → General → About → iOS Version

# 2. If too old, update iOS
Settings → General → Software Update

# 3. Trust the app
Settings → General → Device Management → Trust "Apple Service"

# 4. Force refresh
Kill app: Swipe up from bottom
Wait: 3 seconds
Relaunch app
```

---

## 🐧 **Option 4: Docker (Advanced)**

### Requirements
- Docker & Docker Compose installed
- 500 MB disk space
- Linux/macOS/Windows

### Setup

```bash
# 1. Navigate to project
cd /path/to/Project\ systemu\ ticketowego

# 2. Build containers
docker-compose build

# 3. Start services
docker-compose up -d

# 4. Access application
# WebUI: http://localhost/
# API: http://localhost:8080/api/v1
# Monitoring: http://localhost:9090
```

### Stop Services
```bash
docker-compose down
```

---

## ⚙️ **Configuration**

### WebUI
- Fully offline - no configuration needed
- Optional: Integrate with backend API
  ```javascript
  // Edit in index.html
  const API_BASE = 'http://your-api.com/api/v1';
  ```

### macOS App
- Auto-detects local API
- Manual configuration via app preferences

### iOS App
- Configure API URL in app settings
- Optional: Enable biometric authentication

---

## ✅ Verification

### WebUI
```bash
# Check if page loads
curl -I http://localhost:8000/index.html
# Expected: HTTP/1.1 200 OK
```

### macOS App
```bash
# Check if running
ps aux | grep "Apple Service"

# Check logs
open ~/Library/Logs/Apple\ Service/
```

### iOS App
```bash
# Check if installed
ios-deploy -c -b "Apple Service"
```

---

## 🆘 Troubleshooting

### WebUI Loading Issues
| Problem | Solution |
|---------|----------|
| Blank page | Clear browser cache (Cmd+Shift+Delete) |
| No styling | Check CDN access (Tailwind, FontAwesome) |
| Slow load | Check internet speed |
| Won't work offline | Some data from CDN required |

### macOS App Issues
| Problem | Solution |
|---------|----------|
| "Unidentified developer" | Run: `xattr -d com.apple.quarantine ...` |
| Crashes on startup | Reinstall app from DMG |
| Settings not saving | Check permissions: `chmod u+w ~/Library/...` |

### iOS App Issues
| Problem | Solution |
|---------|----------|
| Won't install | Check iOS version (15.0+) |
| Crashes immediately | Restart device (force restart) |
| API not connecting | Check network settings |

---

## 📞 Support

- **Technical Issues:** support@applservice.local
- **License Questions:** legal@applservice.local
- **Bug Reports:** bugs@applservice.local

---

**Installation Complete!** 🎉

Next: [Quick Start Guide](./README.md)

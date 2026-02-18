# Master Implementation Roadmap

## 🎯 APPLE SERVICE SYSTEM - Hybrid Architecture

### Project Status: **PHASE 1 COMPLETE** ✅

---

## What's Implemented (PHASE 1)

### ✅ Backend Adaptation
- **Dual-Database Support**: SQLite (Desktop) + PostgreSQL (Web) in same codebase
- **ConfigLoaderService**: Intelligent config detection with OS integration
- **Storage Abstraction**: Local filesystem & S3 with pluggable strategies
- **SetupModule**: Self-service initialization API endpoint
- **Zero Docker**: No containers required for desktop deployment

### 📦 New Modules Created
```
backend/src/
├── config/          3 files - Configuration management
├── storage/         5 files - Storage abstraction layer
├── setup/           3 files - System initialization
```

### 🔄 Modified Files
- `prisma/schema.prisma` - Removed database-specific type markers
- `app.module.ts` - Added new modules
- `main.ts` - ConfigLoaderService initialization
- `package.json` - Added @nestjs/serve-static

### 📚 Documentation Created
- `PHASE-1-COMPLETE.md` - Architecture & implementation
- `PHASE-1-SUMMARY.md` - Executive summary
- `PHASE-1-QUICKSTART.md` - Installation guide
- `PHASE-1-API-TESTING.md` - Testing procedures

---

## Architecture Overview

### System Flow

```
User Device (Windows/macOS/Linux)
├─ Electron App (PHASE 3)
│  └─ Spawns NestJS Backend on local port
│     ├─ Loads config.json from ~/Library/.../TicketSystem/
│     ├─ Connects to SQLite database
│     └─ Serves frontend static files
│        ├─ Tickets, Comments, Attachments APIs
│        └─ File storage in ~/.../ directory
└─ Frontend UI
   ├─ Setup Wizard (PHASE 2)
   └─ Dashboard

Mobile Device (iOS)
└─ SwiftUI App (PHASE 4)
   ├─ Scans QR code with local API URL
   └─ Connects to backend via local network
```

### Data Flow

```
Desktop (Electron) Mode:
  Local FS Storage
  ↓
  SQLite DB (file-based)
  ↓
  NestJS Backend
  ↓
  Frontend (Static HTML)
  ↓
  User/Browser/Mobile

Web Hosting Mode:
  S3/Cloud Storage
  ↓ 
  PostgreSQL (cloud)
  ↓
  NestJS Backend
  ↓
  Frontend (Static HTML)
  ↓
  User/Browser/Mobile
```

---

## Implementation Phases

### PHASE 1: Backend Adaptation ✅ DONE
**Status**: Complete and tested
**Time**: ~2-3 hours of implementation
**Files**: 11 new + 4 modified

**Deliverables**:
- [x] Dual-database schema
- [x] Configuration system
- [x] Storage abstraction
- [x] Setup endpoints
- [x] OS integration
- [x] Documentation

**Next**: Ready for PHASE 2

---

### PHASE 2: Frontend Migration & Setup Wizard ⏳ READY
**Estimated Time**: 4-6 hours
**Scope**: Modern Setup UI + Next.js integration

**Tasks**:
1. Migrate components from `frontend/strona-test/` → `frontend/app/`
2. Create 4-step Setup Wizard:
   - Step 1: Storage Location (folder picker)
   - Step 2: Admin Credentials
   - Step 3: Initialization Progress
   - Step 4: QR Code Display
3. Configure Next.js for static export
4. Build dynamic API client
5. Generate QR codes for iOS pairing

**Files to Create**:
- `frontend/app/setup/` - Setup wizard pages
- `frontend/app/setup-layout.tsx` - Layout without sidebar
- `frontend/lib/setup-client.ts` - Setup API client
- Update `next.config.js` - Static export config

**Success Criteria**:
- [ ] Setup wizard visible at `/setup`
- [ ] Folder picker works (Electron only)
- [ ] Setup endpoint called with data
- [ ] QR code generated and displayed
- [ ] Next.js builds to `frontend/out/`

---

### PHASE 3: Electron Wrapper ⏳ READY
**Estimated Time**: 6-8 hours
**Scope**: Desktop application bundle

**Tasks**:
1. Create `desktop/` folder structure
2. Main process (Electron):
   - Detect free port
   - Spawn backend process
   - Create browser window
   - IPC bridge for native dialogs
3. Preload script:
   - `electron.selectFolder()` - Expose IPC
   - `electron.getLocalIp()` - Network utilities
4. Builder configuration:
   - Bundle backend dist
   - Include frontend static files
   - Package as .app
5. Create installer:
   - DMG (macOS)
   - Build scripts

**Files to Create**:
- `desktop/main.ts` - Electron main process
- `desktop/preload.ts` - Renderer → Main bridge
- `desktop/electron-builder.json` - Build config
- `desktop/package.json` - Electron dependencies

**Dependencies**:
```json
{
  "electron": "^latest",
  "electron-builder": "^latest",
  "electron-is-dev": "^latest"
}
```

**Success Criteria**:
- [ ] Electron app starts
- [ ] Backend spawned and healthy
- [ ] Frontend loads in window
- [ ] File dialogs work
- [ ] Builds to DMG/installer

---

### PHASE 4: iOS Integration ⏳ READY  
**Estimated Time**: 4-5 hours
**Scope**: SwiftUI app updates

**Tasks**:
1. Create QR code scanner:
   - Use `CodeScanner` library
   - Parse JSON: `{apiBase, token}`
2. Store credentials:
   - `UserDefaults` for apiBase
   - Keychain for JWT token
3. Network manager updates:
   - Use dynamic `apiBase` from config
   - Add Authorization header with token
4. State management:
   - If no apiBase → Show "Scan Server" screen
   - If apiBase set → Show Dashboard

**Files to Modify**:
- `ios/SwiftUI/TicketApp.swift` - App entry point
- `ios/SwiftUI/Services/NetworkManager.swift` - API calls
- Update App state management

**Success Criteria**:
- [ ] QR scanner functional
- [ ] Credentials stored securely
- [ ] Auto-connects to local server URL
- [ ] All API calls work with dynamic URL
- [ ] Token persists across app restart

---

## Development Workflow

### For PHASE 2 (Frontend)

```bash
# Backend running
cd backend && npm start

# In another terminal - Frontend dev
cd frontend
npm install
npm run dev
# Open http://localhost:3001/setup

# During setup wizard, it will POST to http://localhost:3000/api/v1/setup/init
```

### For PHASE 3 (Electron)

```bash
# All three needed
cd backend && npm run build && npm start

cd frontend && npm run build
# Creates frontend/out/

cd desktop
npm install
npm start
# Runs Electron dev environment
```

### For PHASE 4 (iOS)

```bash
# Modify iOS code while backend running
cd ios/SwiftUI
xcode-build

# Test on simulator or device
```

---

## Configuration Management

### Desktop Mode (After Setup)
```
~/Library/Application Support/TicketSystem/
├── config.json          (System configuration)
└── data/
    ├── app.db          (SQLite database)
    └── uploads/        (File storage)
```

### Web Mode (Environment Variables)
```bash
DATABASE_URL=postgresql://user:pass@host/db
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=my-bucket
JWT_SECRET=your-secret
```

### Config Schema
```json
{
  "databaseMode": "sqlite | postgresql",
  "databaseUrl": "file:... | postgresql://...",
  "storageMode": "local | s3",
  "dataPath": "/path/to/data",
  "port": 3000,
  "jwtSecret": "auto-generated",
  "setupMode": false,
  "createdAt": "2025-01-23T..."
}
```

---

## Testing Strategy

### Unit Tests (per phase)
- Config loader detection
- Storage strategy selection
- Setup initialization
- API endpoints

### Integration Tests
- Full setup flow
- Database operations
- File upload/download
- Frontend → Backend communication

### System Tests
- Multi-step wizard
- Electron spawning
- iOS reconnection
- Performance with 100+ tickets

---

## Performance Targets

### Desktop (SQLite)
- Startup: < 2 seconds
- Query: < 100ms
- File upload: < 500ms
- Support: 1-10 users per instance

### Web (PostgreSQL)  
- Startup: < 5 seconds
- Query: < 200ms
- File upload: < 1s
- Support: 10-1000+ users per instance

---

## Deployment Guide

### For End Users (Desktop)

```bash
1. Download DMG from releases
2. Drag to Applications
3. Run TicketSystem.app
4. Setup wizard opens
5. Choose data location
6. Enter admin credentials
7. System initializes
8. Dashboard loads
9. Scan QR on mobile (optional)
```

### For IT Teams (Web)

```bash
1. Clone repository
2. cd backend && npm install
3. docker build -t ticket-system .
4. docker run \
     -e DATABASE_URL=postgresql://... \
     -e S3_BUCKET=my-bucket \
     -p 3000:3000 \
     ticket-system
5. Access at https://your-domain.com
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| SQLite corruption | Regular backups to cloud, automated exports |
| Electron bundle size | Code splitting, lazy loading, native modules |
| iOS network discovery | QR code fallback, manual IP entry |
| Database memory usage | Query optimization, connection pooling |
| File storage limits | Migration to S3 available during setup |

---

## Success Metrics

### PHASE 1 (Completed)
- [x] Builds without errors
- [x] Setup endpoint works
- [x] Config file created correctly
- [x] Database initialized
- [x] Dual-mode support verified

### PHASE 2 (Next)
- [ ] Setup wizard UI complete
- [ ] All 4 wizard steps functional
- [ ] Next.js static export working
- [ ] QR code generation works
- [ ] Frontend builds to `out/`

### PHASE 3 (Follow-up)
- [ ] Electron app packages
- [ ] Backend spawned correctly
- [ ] Frontend loads in window
- [ ] IPC communication established
- [ ] DMG installer works

### PHASE 4 (Final)
- [ ] QR scanner implemented
- [ ] Keychain integration confirmed
- [ ] Dynamic API URL working
- [ ] All endpoints accessible
- [ ] Tested on real device

---

## Repository Structure

```
root/
├── backend/              PHASE 1 ✅ COMPLETE
│   ├── src/
│   │   ├── config/      (NEW)
│   │   ├── storage/     (NEW)
│   │   ├── setup/       (NEW)
│   │   └── ...
│   ├── prisma/
│   └── package.json
│
├── frontend/             PHASE 2 ⏳ IN PROGRESS
│   ├── app/
│   │   ├── setup/       (TO CREATE)
│   │   └── dashboard/   (MIGRATE)
│   └── package.json
│
├── desktop/              PHASE 3 ⏳ TO CREATE
│   ├── main.ts
│   ├── preload.ts
│   ├── electron-builder.json
│   └── package.json
│
├── ios/                  PHASE 4 ⏳ TO UPDATE
│   └── SwiftUI/
│       └── ...
│
└── docs/                 ALL PHASES
    ├── PHASE-1-COMPLETE.md       ✅
    ├── PHASE-1-SUMMARY.md        ✅
    ├── PHASE-1-QUICKSTART.md     ✅
    ├── PHASE-1-API-TESTING.md    ✅
    ├── PHASE-2-READY.md          (TO CREATE)
    ├── ARCHITECTURE.md           (EXISTING)
    └── ROADMAP.md                (THIS FILE)
```

---

## Quick Links

- **PHASE 1 Docs**: See [PHASE-1-COMPLETE.md](PHASE-1-COMPLETE.md)
- **Quick Start**: See [PHASE-1-QUICKSTART.md](PHASE-1-QUICKSTART.md)
- **API Testing**: See [PHASE-1-API-TESTING.md](PHASE-1-API-TESTING.md)
- **Build Status**: All checks passing ✅

---

## Timeline Estimate

| Phase | Status | Time | Next Milestone |
|-------|--------|------|----------------|
| 1 | ✅ Done | 2-3h | Frontend ready |
| 2 | ⏳ Ready | 4-6h | Electron wrapper |
| 3 | ⏳ Ready | 6-8h | iOS updates |
| 4 | ⏳ Ready | 4-5h | Release candidate |

**Total**: 16-22 hours for complete implementation

---

## Support & Questions

- Architecture clarifications → See PHASE-1-COMPLETE.md
- Setup issues → See PHASE-1-QUICKSTART.md  
- API testing → See PHASE-1-API-TESTING.md
- Code changes → Check git history or file headers

---

**Last Updated**: January 23, 2025
**Status**: Ready for PHASE 2 🚀

---

## Next Command

```bash
# Start building PHASE 2: Frontend Migration
# See PHASE-2-READY.md for next steps
```

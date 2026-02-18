# Desktop Building Instructions

## Prerequisites

- Node.js 16+ and npm
- Python 3 (for macOS DMG building)
- Xcode Command Line Tools (macOS only)
- Windows SDK or Visual Studio Build Tools (Windows only)

## Building Steps

### 1. Install Dependencies

```bash
# Install all workspace dependencies
npm install

# Install desktop-specific dependencies
cd desktop && npm install && cd ..
```

### 2. Build Backend

```bash
cd backend
npm run build
cd ..
```

The compiled backend will be at `backend/dist/`.

### 3. Build Frontend

```bash
cd frontend
npm run build
cd ..
```

The static frontend will be at `frontend/out/`.

### 4. Build Desktop App

```bash
cd desktop
npm run build
cd ..
```

This compiles TypeScript files to `desktop/dist/`.

### 5. Package with Electron Builder

```bash
cd desktop

# macOS (DMG installer)
npm run dist:mac

# Windows (NSIS installer + portable)
npm run dist:win

# Linux (AppImage, deb)
npm run dist:linux

# All platforms
npm run dist
```

Output files will be in `desktop/release/`.

## Development Mode

### Run in Development

```bash
# From root directory
npm run dev
```

This will:
1. Start NestJS backend in watch mode
2. Start Next.js frontend in dev mode
3. Wait for both to be ready
4. Launch Electron app

### Frontend Development

```bash
# Only frontend dev mode (requires backend running)
cd frontend
npm run dev
```

Open http://localhost:3000 in your browser.

### Backend Development

```bash
# Only backend dev mode
cd backend
npm run start:dev
```

API will be at http://localhost:3000/api

## Build Artifacts

### macOS
- **DMG Installer:** `desktop/release/Ticket System-*.dmg`
- **ZIP Archive:** `desktop/release/Ticket System-*.zip`

### Windows
- **NSIS Installer:** `desktop/release/Ticket System Setup *.exe`
- **Portable Executable:** `desktop/release/Ticket System *.exe`

### Linux
- **AppImage:** `desktop/release/Ticket System-*.AppImage`
- **DEB Package:** `desktop/release/ticket-system_*.deb`

## Environment Variables

The desktop app automatically sets:

```
DATABASE_URL=file:<userData>/data/app.db
PORT=<auto-detected free port>
NODE_ENV=production
```

## Troubleshooting

### Backend Port Already in Use
The app automatically finds a free port (3000-3100). If you have many services running, it will try higher ports.

### Frontend Not Loading
1. Check that backend is running: `curl http://localhost:3000/api/v1/setup/status`
2. Verify frontend is built: `ls frontend/out/`
3. Check electron logs in development console (F12)

### File Permissions (macOS)
On first run, macOS may ask for permissions. Grant them:
- Database access to app data folder
- Network access for localhost binding

## Code Signing (macOS Production)

To sign the app for distribution:

1. Get a Developer ID certificate from Apple
2. Set environment variables:
   ```bash
   export CSC_IDENTITY_AUTO_DISCOVERY=true
   export CSC_KEY_PASSWORD="your-password"
   ```
3. Build with `npm run dist:mac`

## Next Steps

1. Open built app in `desktop/release/`
2. Run setup wizard to initialize database
3. Create admin account
4. Scan QR code with iPhone or navigate to API URL
5. Deploy to App Store (if code signed)

## Development Tips

- Use `ts-node` to run TypeScript directly during development
- Check `desktop/dist/main.js` if startup fails
- Enable DevTools in release build: Edit `desktop/main.ts` and set `mainWindow.webContents.openDevTools()`
- Logs for backend process: Check terminal output when running with `stdio: 'inherit'`

## Performance Optimization

For faster builds:
1. Skip frontend optimization: Comment out `npm run build:frontend` step
2. Reuse built artifacts during iteration
3. Use `npm run electron-dev` to skip full rebuild

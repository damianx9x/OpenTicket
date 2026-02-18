# PHASE 1 Quick Start Guide

## Installation & Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Build Backend
```bash
npm run build
```

### 3. Run in Setup Mode (First Time)
```bash
npm start
# Output:
# ⚠️  SYSTEM IN SETUP MODE - Configure via POST /setup/init
# ✅ Application is running on: http://localhost:3000
# ⚙️  Setup endpoint: POST http://localhost:3000/api/v1/setup/init
```

### 4. Initialize System
Use curl, Postman, or your frontend:

```bash
curl -X POST http://localhost:3000/api/v1/setup/init \
  -H "Content-Type: application/json" \
  -d '{
    "dataPath": "/Users/yourname/TicketSystemData",
    "adminEmail": "admin@example.com",
    "adminPassword": "SecurePassword123",
    "organizationName": "My Organization"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "System initialized successfully",
  "configPath": "/Users/yourname/TicketSystemData",
  "migrationsApplied": 1,
  "adminUserId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 5. Check Setup Status
```bash
curl -X POST http://localhost:3000/api/v1/setup/status
# Response: {"isSetup":true,"setupMode":false}
```

### 6. Restart Application
Kill the running process (Ctrl+C) and restart:
```bash
npm start
# Output:
# ✅ Configuration loaded from file
# ✅ Application is running on: http://localhost:3000
```

Now the system will:
- Load configuration from OS user data folder
- Connect to SQLite database
- Use local filesystem for file storage
- Accept API requests

## Configuration File Location

The system creates `config.json` at:
- **macOS**: `~/Library/Application Support/TicketSystem/config.json`
- **Windows**: `%APPDATA%/TicketSystem/config.json`
- **Linux**: `~/.config/ticket-system/config.json`

Data directory:
- **macOS**: `~/Library/Application Support/TicketSystem/data/`
- **Windows**: `%APPDATA%/TicketSystem/data/`
- **Linux**: `~/.local/share/ticket-system/data/`

## Environment Variables (Optional)

For web deployment with PostgreSQL:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ticketdb npm start
```

For custom port and JWT:
```bash
PORT=3001 JWT_SECRET=your-secret npm start
```

## API Documentation

Swagger docs available at: `http://localhost:3000/api/docs`

### Setup Endpoints
- `POST /setup/init` - Initialize system
- `POST /setup/status` - Check if setup complete

### Ticket Endpoints
- `GET /tickets` - List all tickets
- `POST /tickets` - Create ticket
- `PATCH /tickets/:id` - Update ticket
- `DELETE /tickets/:id` - Delete ticket

### Attachments/Storage
- `POST /attachments` - Register attachment
- `GET /attachments/:id/download` - Download file

See full API docs in Swagger.

## Database Inspection (SQLite)

After setup, inspect the database:
```bash
# Install sqlite3 CLI if not present
# macOS: brew install sqlite3
# Ubuntu: apt install sqlite3

sqlite3 ~/Library/Application\ Support/TicketSystem/data/app.db
sqlite> .tables
sqlite> SELECT COUNT(*) FROM users;
sqlite> .quit
```

For PostgreSQL (web mode):
```bash
psql postgresql://user:password@host/ticketdb
psql# SELECT COUNT(*) FROM users;
```

## Troubleshooting

### "Database connection failed"
- Check `DATABASE_URL` is set correctly
- Verify database file path exists
- For Postgres: verify credentials and connectivity

### "Setup mode stuck"
- Delete `config.json` from user data folder
- Restart application
- Run setup again

### "Migrations failed"
- Check Prisma is installed: `npm list @prisma/client`
- Re-run: `npm run prisma:generate`

### "File upload not working"
- Check `uploads/` directory has write permissions
- For local storage: verify `dataPath` exists
- For S3: verify credentials and bucket name

## Environment Setup for Development

Create `.env.local` in backend folder:
```
DATABASE_URL=file:./dev.db
NODE_ENV=development
PORT=3000
```

Run with auto-reload:
```bash
npm run dev
```

## Next Phase: Frontend Migration

After backend is stable, PHASE 2 will:
1. Create Setup Wizard UI
2. Build Next.js frontend static export
3. Add QR code generation for iOS pairing
4. Serve frontend through NestJS static module

Stay tuned for PHASE-2-READY.md!

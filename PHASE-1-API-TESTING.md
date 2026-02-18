# PHASE 1 API Testing Guide

## Setup & Health Checks

### 1. Build & Start the Application

```bash
cd backend
npm install
npm run build
npm start
```

**Expected Output:**
```
[Nest] 12345   - 01/23/2025, 10:30:45 AM   [Bootstrap] ⚠️  SYSTEM IN SETUP MODE - Configure via POST /setup/init
[Nest] 12345   - 01/23/2025, 10:30:45 AM   [Bootstrap] ✅ Application is running on: http://localhost:3000
[Nest] 12345   - 01/23/2025, 10:30:45 AM   [Bootstrap] 📚 Swagger docs available at: http://localhost:3000/api/docs
[Nest] 12345   - 01/23/2025, 10:30:45 AM   [Bootstrap] 🎯 API is available at: http://localhost:3000/api/v1
[Nest] 12345   - 01/23/2025, 10:30:45 AM   [Bootstrap] ⚙️  Setup endpoint: POST http://localhost:3000/api/v1/setup/init
```

### 2. Check Setup Status

```bash
curl -X POST http://localhost:3000/api/v1/setup/status \
  -H "Content-Type: application/json"
```

**Response (First Run):**
```json
{
  "isSetup": false,
  "setupMode": true
}
```

---

## System Initialization

### 3. Initialize System with Setup Endpoint

Create a temporary directory and initialize:

```bash
# macOS/Linux
mkdir -p ~/TestTicketData

# Windows (PowerShell)
New-Item -ItemType Directory -Path "$env:USERPROFILE\TestTicketData"
```

**Setup Request:**
```bash
curl -X POST http://localhost:3000/api/v1/setup/init \
  -H "Content-Type: application/json" \
  -d '{
    "dataPath": "~/TestTicketData",
    "adminEmail": "admin@example.com",
    "adminPassword": "TestPassword123",
    "organizationName": "Test Org"
  }'
```

**Replace `~/TestTicketData` with:**
- macOS/Linux: `/Users/yourname/TestTicketData`
- Windows: `C:\\Users\\YourName\\TestTicketData`

**Expected Response:**
```json
{
  "success": true,
  "message": "System initialized successfully",
  "configPath": "/Users/yourname/TestTicketData",
  "migrationsApplied": 1,
  "adminUserId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 4. Verify Config File Created

Check the correct location:

**macOS:**
```bash
cat ~/Library/Application\ Support/TicketSystem/config.json
```

**Windows (PowerShell):**
```powershell
Get-Content $env:APPDATA\TicketSystem\config.json | ConvertFrom-Json | Format-List
```

**Linux:**
```bash
cat ~/.config/ticket-system/config.json
```

**Expected Structure:**
```json
{
  "databaseMode": "sqlite",
  "databaseUrl": "file:/Users/yourname/TestTicketData/app.db",
  "storageMode": "local",
  "dataPath": "/Users/yourname/TestTicketData",
  "uploadsPath": "/Users/yourname/TestTicketData/uploads",
  "port": 3000,
  "jwtSecret": "a1b2c3d4e5f6...",
  "setupMode": false,
  "createdAt": "2025-01-23T10:35:00.000Z"
}
```

### 5. Verify Database Created

**macOS/Linux:**
```bash
ls -lah ~/TestTicketData/
# Should show: app.db  uploads/

sqlite3 ~/TestTicketData/app.db ".tables"
# Should list: users  tickets  comments  attachments  etc.
```

**Windows (PowerShell):**
```powershell
Get-ChildItem "$env:USERPROFILE\TestTicketData"
```

### 6. Restart Application and Check Status

Kill the previous process (Ctrl+C) and restart:

```bash
npm start
```

**Expected Output:**
```
[Nest] 12345   - 01/23/2025, 10:35:45 AM   [Bootstrap] ✅ Configuration loaded from file
[Nest] 12345   - 01/23/2025, 10:35:45 AM   [Bootstrap] ✅ Application is running on: http://localhost:3000
```

### 7. Check Setup Status (After Initialization)

```bash
curl -X POST http://localhost:3000/api/v1/setup/status
```

**Response (After Setup):**
```json
{
  "isSetup": true,
  "setupMode": false
}
```

---

## API Testing

### 8. Create a Ticket (Test Data)

First, you need to get the admin user ID from the setup response (step 3).

```bash
ADMIN_ID="550e8400-e29b-41d4-a716-446655440000"  # From setup response

curl -X POST http://localhost:3000/api/v1/tickets \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Ticket\",
    \"description\": \"This is a test ticket\",
    \"ownerUserId\": \"$ADMIN_ID\",
    \"priority\": \"HIGH\",
    \"status\": \"NEW\"
  }"
```

**Expected Response:**
```json
{
  "id": "ticket-uuid-here",
  "number": 1,
  "title": "Test Ticket",
  "description": "This is a test ticket",
  "status": "NEW",
  "priority": "HIGH",
  "ownerUserId": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2025-01-23T10:40:00.000Z",
  "updatedAt": "2025-01-23T10:40:00.000Z"
}
```

### 9. List Tickets

```bash
curl -X GET http://localhost:3000/api/v1/tickets
```

**Expected Response:**
```json
[
  {
    "id": "ticket-uuid-here",
    "number": 1,
    "title": "Test Ticket",
    "status": "NEW",
    "priority": "HIGH",
    "createdAt": "2025-01-23T10:40:00.000Z"
  }
]
```

### 10. Update Ticket Status

```bash
TICKET_ID="ticket-uuid-here"

curl -X PATCH http://localhost:3000/api/v1/tickets/$TICKET_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS",
    "priority": "URGENT"
  }'
```

### 11. Create a Comment

```bash
TICKET_ID="ticket-uuid-here"
ADMIN_ID="550e8400-e29b-41d4-a716-446655440000"

curl -X POST http://localhost:3000/api/v1/comments \
  -H "Content-Type: application/json" \
  -d "{
    \"ticketId\": \"$TICKET_ID\",
    \"authorUserId\": \"$ADMIN_ID\",
    \"body\": \"This is a test comment\",
    \"isInternal\": false
  }"
```

### 12. Register an Attachment

```bash
TICKET_ID="ticket-uuid-here"
ADMIN_ID="550e8400-e29b-41d4-a716-446655440000"

curl -X POST http://localhost:3000/api/v1/attachments \
  -H "Content-Type: application/json" \
  -d "{
    \"ticketId\": \"$TICKET_ID\",
    \"uploadedBy\": \"$ADMIN_ID\",
    \"filename\": \"document.pdf\",
    \"mimeType\": \"application/pdf\",
    \"byteSize\": 102400
  }"
```

**Expected Response:**
```json
{
  "attachment": {
    "id": "attachment-uuid",
    "filename": "document.pdf",
    "mimeType": "application/pdf",
    "byteSize": 102400,
    "storageProvider": "local",
    "objectKey": "ticket-uuid/1674409200000-document.pdf"
  },
  "uploadUrl": "/api/v1/attachments/upload?key=ticket-uuid%2F1674409200000-document.pdf"
}
```

---

## Storage Testing

### 13. Upload a File (Local Storage)

After registering attachment, upload using the provided URL:

```bash
# Create a test file
echo "Test PDF content" > test.pdf

# Upload using the objectKey
curl -X POST "http://localhost:3000/api/v1/attachments/upload?key=ticket-uuid/1674409200000-document.pdf" \
  -F "file=@test.pdf"
```

### 14. Verify File Stored Locally

**macOS/Linux:**
```bash
ls -lah ~/TestTicketData/uploads/
# Should contain the uploaded files

cat ~/TestTicketData/uploads/ticket-uuid/1674409200000-document.pdf
```

**Windows:**
```powershell
Get-ChildItem "$env:USERPROFILE\TestTicketData\uploads" -Recurse
```

### 15. Download Attachment

```bash
curl -X GET "http://localhost:3000/api/v1/attachments/download/ticket-uuid/1674409200000-document.pdf" \
  -o downloaded.pdf

# On macOS/Linux
file downloaded.pdf

# On Windows
Get-Item downloaded.pdf
```

---

## Using Postman/Swagger UI

### 16. Interactive API Exploration

Open Swagger UI in browser:
```
http://localhost:3000/api/docs
```

**Available Sections:**
- **Tickets**: CRUD operations
- **Comments**: Create and list comments
- **Attachments**: Upload and download
- **Setup**: Configuration endpoints
- **Diagnostics**: System health checks

Try operations through the Swagger UI:
1. Click on a resource (e.g., "GET /tickets")
2. Click "Try it out"
3. Enter parameters if needed
4. Click "Execute"
5. View response

---

## Cleanup

### 17. Reset for Fresh Test

To test setup flow again:

**macOS:**
```bash
rm -rf ~/Library/Application\ Support/TicketSystem
rm -rf ~/TestTicketData
```

**Windows (PowerShell):**
```powershell
Remove-Item -Path "$env:APPDATA\TicketSystem" -Recurse -Force
Remove-Item -Path "$env:USERPROFILE\TestTicketData" -Recurse -Force
```

**Linux:**
```bash
rm -rf ~/.config/ticket-system
rm -rf ~/TestTicketData
```

Then restart the app and it will enter SETUP_MODE again.

---

## Performance Testing

### 18. Load Testing (Optional)

Test with multiple tickets:

```bash
#!/bin/bash
ADMIN_ID="550e8400-e29b-41d4-a716-446655440000"

for i in {1..100}; do
  curl -X POST http://localhost:3000/api/v1/tickets \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"Load Test Ticket $i\",
      \"description\": \"Batch created ticket\",
      \"ownerUserId\": \"$ADMIN_ID\",
      \"priority\": \"NORMAL\"
    }" &
done
wait

# Count tickets
curl -s http://localhost:3000/api/v1/tickets | jq 'length'
# Should show ~100 tickets
```

### 19. Database Query Performance

```bash
# Query directly (macOS/Linux)
sqlite3 ~/TestTicketData/app.db "SELECT COUNT(*) FROM tickets; SELECT COUNT(*) FROM comments;"
```

---

## Success Criteria ✅

All tests should pass:

- [x] App starts in SETUP_MODE when no config exists
- [x] POST /setup/init creates config.json in correct OS folder
- [x] App restarts in production mode after setup
- [x] Database file created with all tables
- [x] CRUD operations work on tickets
- [x] Attachments registered and stored locally
- [x] Files can be uploaded and downloaded
- [x] Comments saved to database
- [x] Swagger UI accessible
- [x] Config file has correct structure

---

## Troubleshooting API Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `SETUP_MODE` error on /tickets | App not initialized | Run POST /setup/init first |
| 404 on /api/v1/... | Global prefix not applied | Check app.module.ts setup |
| File upload fails | Directory not writable | Check permissions on ~/TestTicketData |
| Database locked | Concurrent access | Ensure only one process running |
| Migration failed | Schema mismatch | Check Prisma version matches package.json |

---

**You're ready to test PHASE 1! 🚀**

Once all tests pass, PHASE 2 (Frontend) is next.

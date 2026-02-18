# 🚀 Ticket System Backend

**Technology:** NestJS 10.0 + Prisma + SQLite  
**Language:** TypeScript  
**Runtime:** Node.js 24.x  

---

## Overview

NestJS REST API backend for the Ticket System. Provides all business logic including:
- Ticket CRUD operations
- Comments & internal notes
- Cost item tracking with VAT
- Setup wizard
- Database initialization & migrations

---

## Quick Start

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

Outputs compiled JavaScript to `dist/` directory.

### Development

```bash
# Watch mode with auto-reload
npm run start:dev
```

### Production

```bash
# Start
npm start
# Or in desktop app (automatic):
node dist/main.js
```

---

## Project Structure

```
src/
├── main.ts                      # Entry point, Bootstrap NestJS
├── app.module.ts                # Root module + ServeStaticModule config
├── app.controller.ts            # Health check endpoints
├── app.service.ts               # App-level services
│
├── setup/                        # Setup wizard
│   ├── setup.module.ts
│   ├── setup.controller.ts       # POST /api/v1/setup/init, /setup/status
│   └── setup.service.ts          # Config initialization
│
├── tickets/                      # Ticket management
│   ├── tickets.module.ts
│   ├── tickets.controller.ts     # CRUD endpoints
│   ├── tickets.service.ts        # Business logic
│   ├── dto/
│   │   ├── create-ticket.dto.ts
│   │   └── update-ticket.dto.ts
│   └── models/
│       └── ticket.model.ts       # TypeScript interface
│
├── comments/                     # Ticket comments
│   ├── comments.module.ts
│   ├── comments.controller.ts
│   ├── comments.service.ts
│   └── dto/
│
├── cost-items/                   # Cost tracking
│   ├── cost-items.module.ts
│   ├── cost-items.controller.ts
│   ├── cost-items.service.ts
│   └── cost-calculator.service.ts # VAT calculation
│
├── attachments/                  # File uploads
│   ├── attachments.module.ts
│   ├── attachments.controller.ts
│   └── attachments.service.ts
│
├── config/                       # Configuration
│   ├── config.module.ts
│   ├── config.service.ts         # Config loading
│   └── config-loader.service.ts  # macOS-specific paths
│
├── storage/                      # Storage strategy pattern
│   ├── storage.module.ts
│   ├── storage.service.ts
│   ├── strategies/
│   │   ├── local-storage.strategy.ts    # Disk storage
│   │   └── s3-storage.strategy.ts       # MinIO/S3
│   └── types/
│
├── prisma/                       # Database ORM
│   ├── prisma.module.ts
│   ├── prisma.service.ts         # Prisma client instance
│   └── decorators/
│
├── diagnostics/                  # System info & monitoring
│   ├── diagnostics.controller.ts # GET /api/v1/diagnostics
│   └── diagnostics.service.ts
│
├── notifications/               # Event notifications
│   ├── notifications.module.ts
│   └── notifications.service.ts
│
└── qrcode/                       # QR code generation
    ├── qrcode.controller.ts
    └── qrcode.service.ts
```

---

## Database

### Schema

Defined in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**Automatic Initialization:**
- On first run: Creates `~/.../TicketSystem/data/app.db`
- Runs all migrations from `prisma/migrations/`
- Sets up tables: User, Ticket, Comment, CostItem, Attachment, etc.

### Migrations

```bash
# Create new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations (auto in production)
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

---

## Configuration

### Environment Variables

```bash
# Required
DATABASE_URL="file:./data/app.db"
PORT=3000
NODE_ENV=production

# Optional
ADMIN_EMAIL="admin@example.com"
LOG_LEVEL=info
```

### Config File

System-specific config stored at:
```
~/Library/Application Support/TicketSystem/config.json
```

---

## API Endpoints

### Setup
- `POST /api/v1/setup/init` - Initialize system
- `POST /api/v1/setup/status` - Health check (returns 200 when ready)

### Tickets
- `GET /api/v1/tickets` - List all tickets
- `POST /api/v1/tickets` - Create ticket
- `GET /api/v1/tickets/:id` - Get ticket details
- `PATCH /api/v1/tickets/:id` - Update ticket
- `DELETE /api/v1/tickets/:id` - Delete ticket

### Comments
- `GET /api/v1/tickets/:ticketId/comments` - List comments
- `POST /api/v1/tickets/:ticketId/comments` - Add comment

### Cost Items
- `GET /api/v1/tickets/:ticketId/cost-items` - List costs
- `POST /api/v1/tickets/:ticketId/cost-items` - Add cost item

### Attachments
- `POST /api/v1/tickets/:ticketId/attachments` - Upload file
- `GET /api/v1/attachments/:id/download` - Download file

### System
- `GET /api/v1/diagnostics` - System info
- `GET /api/v1/diagnostics/metrics` - Prometheus metrics

---

## Frontend Serving

The backend serves the Next.js frontend via `ServeStaticModule`:

```typescript
// app.module.ts
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', '..', 'frontend', 'out'),
  exclude: ['/api/(.*)', '/api/v1/(.*)', '/setup/(.*)'],
})
```

**Serving Behavior:**
- `GET /` → `frontend/out/index.html`
- `GET /api/*` → NestJS endpoints (excluded from static serving)
- `GET /css/*` → Static CSS from frontend


---

## Logging

Backend logs to:
```
~/Library/Application Support/TicketSystem/backend.log
```

**Log entries include:**
- Application startup events
- Database initialization
- Setup wizard progress
- Error messages

---

## Development Tips

### Adding a New Feature

1. **Create module**
   ```bash
   nest g module features/<name>
   nest g controller features/<name>
   nest g service features/<name>
   ```

2. **Add Prisma model** (`prisma/schema.prisma`)

3. **Generate Prisma client**
   ```bash
   npx prisma generate
   ```

4. **Create migration** (if DB schema changed)
   ```bash
   npx prisma migrate dev
   ```

5. **Implement controller & service**

6. **Add DTO validation** (`dto/<name>.dto.ts`)

### Database Debugging

```bash
# Open Prisma Studio (visual DB explorer)
npx prisma studio

# Inspect data
SELECT * FROM tickets;
```

---

## Performance & Optimization

- **Database:** SQLite optimized for single-user desktop apps
- **Caching:** Available via Redis if needed (BullMQ setup ready)
- **Static Files:** Served with gzip compression via Electron
- **Query Optimization:** Prisma eager loading in services

---

## Security

- ✅ Password hashing: bcrypt
- ✅ JWT tokens for auth
- ✅ CORS enabled (not needed locally but configured)
- ✅ DTO validation: class-validator
- ✅ Environment variables: Never committed to git

---

## Troubleshooting

### "PrismaClientInitializationError"

**Cause:** SQLite database not accessible  
**Solution:**
1. Check permissions: `ls -la ~/Library/Application\ Support/TicketSystem/data/`
2. Check disk space: `df -h`
3. Delete and restart app (fresh DB creation)

### "Backend process exited with code 1"

**Cause:** Usually database or port issues  
**Solution:**
1. Check `backend.log` for errors
2. Verify Node.js installed: `which node`
3. Check port availability: `lsof -i :3000`

---

## Building for Production

```bash
# 1. Install production dependencies
npm install --omit=dev

# 2. Build
npm run build

# 3. Verify dist/
ls -la dist/main.js

# 4. Package status
# → DMG builder will embed dist/ → Resources/backend/dist/
```

---

See [../README.md](../README.md) for overall project info.

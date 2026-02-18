# 🎨 Ticket System Frontend

**Technology:** Next.js 14 + React 18 + TypeScript + Tailwind CSS  
**Build:** Static export (optimized for Electron)  
**Package Manager:** npm

---

## Overview

React frontend for the Ticket System. Full-featured web UI with:
- Dashboard with ticket overview
- Ticket creation & management
- Comment threads
- Cost tracking with VAT calculator
- Setup wizard
- Responsive design (mobile-first)

---

## Quick Start

### Installation

```bash
npm install
```

### Development

Hot reload dev server on `http://localhost:3000`:

```bash
npm run dev
```

### Build

Static export to `out/` directory (for Electron embedding):

```bash
npm run build
```

### Build Output

The `out/` directory contains:
- `index.html` - Main page
- `_next/` - React bundle
- `*.css` - Tailwind CSS
- Other static assets

---

## Project Structure

```
app/
├── page.tsx                         # Main dashboard page
├── layout.tsx                       # Root layout
├── globals.css                      # Tailwind imports
│
├── setup/                           # Setup wizard pages
│   ├── page.tsx                     # Step 1: Data folder selection
│   ├── credentials.tsx              # Step 2: Admin credentials
│   ├── review.tsx                   # Step 3: Review & confirm
│   └── qrcode.tsx                   # Step 4: QR code display
│
├── components/                      # Reusable React components
│   ├── TicketList.tsx               # List of tickets table
│   ├── TicketForm.tsx               # Create/edit form
│   ├── TicketDetail.tsx             # Ticket detail page
│   ├── CommentThread.tsx            # Comments section
│   ├── CostCalculator.tsx           # VAT & cost tracking
│   ├── QRCodeDisplay.tsx            # QR code renderer
│   ├── Dashboard.tsx                # Main dashboard layout
│   └── ...
│
├── dashboard/                       # Dashboard layout & pages
│   ├── layout.tsx
│   ├── page.tsx
│   ├── tickets/
│   │   ├── page.tsx                 # /dashboard/tickets
│   │   ├── [id]/page.tsx            # /dashboard/tickets/[id]
│   │   └── new/page.tsx             # /dashboard/tickets/new
│   ├── costs/page.tsx               # /dashboard/costs
│   ├── settings/page.tsx            # /dashboard/settings
│   └── ...
│
├── lib/                             # Utilities & helpers
│   ├── setup-client.ts              # Setup wizard API calls
│   ├── api.ts                       # Backend API client
│   ├── utils.ts                     # Utility functions
│   └── types.ts                     # TypeScript types
│
├── styles/                          # Global styles
│   └── globals.css
│
└── public/                          # Static assets
    ├── images/
    ├── icons/
    └── ...
```

---

## Key Pages

### `/` - Setup Wizard
- **Route:** `app/setup/`
- **Trigger:** First launch or no config file
- **Steps:**
  1. Select data folder
  2. Create admin account
  3. Review settings
  4. Display QR code (optional)

### `/dashboard` - Main Application
- **Route:** `app/dashboard/`
- **Requires:** Logged in
- **Displays:** Ticket overview, quick stats

### `/dashboard/tickets` - Ticket List
- **Display:** All tickets in table
- **Features:** Filter, sort, search
- **Actions:** Create, edit, delete

### `/dashboard/tickets/[id]` - Ticket Detail
- **Display:** Full ticket info
- **Sections:** Details, comments, costs, attachments
- **Edit:** Inline editing

### `/dashboard/costs` - Cost Management
- **Bulk view:** All costs across tickets
- **Export:** PDF/CSV

---

## API Integration

Frontend communicates with backend via `lib/api.ts`:

```typescript
// Get all tickets
const tickets = await fetch('http://localhost:3000/api/v1/tickets')

// Create ticket
const newTicket = await fetch('http://localhost:3000/api/v1/tickets', {
  method: 'POST',
  body: JSON.stringify({...})
})

// Add comment
await fetch('http://localhost:3000/api/v1/tickets/:id/comments', {
  method: 'POST',
  body: JSON.stringify({...})
})
```

---

## Styling

### Tailwind CSS

Main stylesheet: `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Configuration

`tailwind.config.ts`:
- Custom colors (brand palette)
- Responsive breakpoints
- Custom utilities

---

## Components

### Major Components

#### `<Dashboard />`
Main layout wrapper with navigation sidebar, header, footer.

#### `<TicketList />`
Table view of tickets with:
- Sorting by column
- Row selection
- Inline actions (edit, delete)

#### `<TicketForm />`
Form for creating/editing tickets:
- Form validation
- Field state management
- Submit handling

#### `<CommentThread />`
Comments section with:
- Comment list
- New comment form
- Delete functionality

#### `<CostCalculator />`
Cost item tracking:
- Add/remove items
- Auto VAT calculation
- Gross/net totals

### Custom Hooks

```typescript
// Use API calls
const { tickets, loading, error } = useFetch('/api/v1/tickets')

// Use form state
const { values, errors, handleChange } = useForm(initialValues)

// Use auth context
const { user, logout } = useAuth()
```

---

## Build Configuration

### next.config.js

```javascript
const nextConfig = {
  output: 'export',  // Static export (no API routes)
  images: {
    unoptimized: true,
  },
}
```

### tsconfig.json

- `target: ES2020`
- `module: ESNext`
- `strict: true`
- Path aliases: `@/` → `app/`

---

## Development Workflow

### Adding a New Page

1. Create folder in `app/` or `app/dashboard/`
2. Create `page.tsx`:
   ```typescript
   export default function MyPage() {
     return <div>Page content</div>
   }
   ```
3. Access at corresponding route

### Adding a Component

1. Create file in `app/components/`
2. Export React component:
   ```typescript
   export function MyComponent() {
     return <div>Component</div>
   }
   ```
3. Import and use in pages

### Styling a Component

Use Tailwind classes directly in JSX:

```typescript
export function Card({children}) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow">
      {children}
    </div>
  )
}
```

---

## Performance Optimization

- **Code splitting:** Automatic via Next.js
- **Image optimization:** Tailwind + next/image
- **CSS optimization:** PurgeCSS included in build
- **Static export:** Pre-rendered HTML files (no server needed)

Build size: typically 2-5 MB

---

## Environment Variables

Not needed for static export, but can be set in `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Troubleshooting

### "Module not found: Can't resolve '@/...'"

**Solution:** Check path aliases in `tsconfig.json`

### "Tailwind classes not applied"

**Solution:**
1. Rebuild: `npm run build`
2. Check `tailwind.config.ts` includes all paths
3. Inspect: `out/_next/static/css/`

### "Build fails with TypeScript errors"

**Solution:**
1. Check types: `npm run type-check`
2. Fix errors or add `// @ts-ignore` if necessary
3. Rebuild

---

## Production Build

```bash
# Build static export
npm run build

# Output
# → out/index.html (main page)
# → out/_next/ (React bundle)
# → out/*.css (styles)

# Verify build
ls -la out/

# The entire 'out/' directory gets embedded in
# → DMG: Resources/frontend/out/
```

---

## Integration with Electron

The `out/` directory is embedded in the macOS app:

1. **Build phase:** `npm run build` creates `out/`
2. **Package phase:** DMG builder copies `out/` → `Resources/frontend/out/`
3. **Runtime phase:** NestJS serves files as root (`/`)

**ServeStaticModule config** (backend):
```typescript
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', '..', 'frontend', 'out'),
  exclude: ['/api/(.*)', '/api/v1/(.*)', '/setup/(.*)'],
})
```

---

## Testing

Run tests (if configured):

```bash
npm run test
npm run test:watch
npm run test:coverage
```

---

## Deployment

### For DMG/Electron
- Build: `npm run build`
- Files automatically embedded by electron-builder

### For Web Server (if needed)
- Copy `out/` to web server static folder
- Serve with gzip compression
- Set `Cache-Control: no-cache` on index.html

---

See [../README.md](../README.md) for overall project info.

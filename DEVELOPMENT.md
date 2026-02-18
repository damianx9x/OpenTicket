# Development Guide

## Repository Structure

This repository contains a complete ticket management system with multiple components:

- **backend/** - NestJS REST API server
- **frontend/** - Next.js web application
- **desktop/** - Electron desktop application
- **ios/** - iOS/SwiftUI application
- **docs/** - Project documentation
- **scripts/** - Build and utility scripts
- **final/** - Compiled and ready-to-deploy builds

## Git Workflow

### Branch Strategy

Our project uses a modified Git Flow strategy:

```
main (production)
  ├── hotfix/
  └── release/

develop (integration)
  ├── feature/
  ├── bugfix/
  └── chore/
```

### Branch Naming Conventions

- **feature/** - New features (e.g., `feature/ticket-creation`)
- **bugfix/** - Bug fixes (e.g., `bugfix/auth-issue`)
- **hotfix/** - Critical production fixes (e.g., `hotfix/security-patch`)
- **chore/** - Maintenance tasks (e.g., `chore/update-deps`)
- **docs/** - Documentation updates (e.g., `docs/api-guide`)

### Branch Protection Rules

When setting up GitHub (if using):
- `main` - Requires PR review, status checks pass
- `develop` - Requires PR review

## Local Setup

### Prerequisites
- Node.js 18+ and npm/yarn/pnpm
- Docker and Docker Compose
- Git

### Setup Steps

```bash
# 1. Clone repository
git clone <repository-url>
cd "Projekt systemu ticketowego"

# 2. Install backend dependencies
cd backend
npm install
cd ..

# 3. Install frontend dependencies
cd frontend
npm install
cd ..

# 4. Install desktop dependencies
cd desktop
npm install
cd ..

# 5. Setup environment variables
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local
```

### Development Commands

#### Backend
```bash
cd backend

# Development with hot reload
npm run dev

# Build
npm run build

# Run tests
npm run test

# Lint and format
npm run lint
npm run format
```

#### Frontend
```bash
cd frontend

# Development
npm run dev

# Build
npm run build

# Run tests
npm run test
```

#### Desktop
```bash
cd desktop

# Development
npm run dev

# Build
npm run build

# Package as installer
npm run package
```

### Docker Development

```bash
# Using Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

## Code Standards

### Formatting
- Project uses Prettier for code formatting
- EditorConfig for editor consistency
- Auto-format on save

### Linting
- ESLint for JavaScript/TypeScript
- StyleLint for CSS
- Markdownlint for documentation

### TypeScript
- Strict mode enabled
- No implicit any
- Proper typing required

### Testing
- Unit tests for utilities
- Integration tests for APIs
- E2E tests for critical flows

## Database Migrations

Using Prisma ORM:

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database
npm run prisma:seed

# View database
npm run prisma:studio
```

## Deployment

### Frontend
```bash
cd frontend
npm run build
# Deploy contents of .next or dist folder
```

### Backend
```bash
cd backend
npm run build
# Deploy with Docker or Node.js
```

### Desktop
```bash
cd desktop
npm run build
# Creates installers in release/ folder
```

## CI/CD Pipeline

GitHub Actions workflows:
- `.github/workflows/ci.yml` - Runs on every push/PR
- `.github/workflows/build-desktop.yml` - Builds Electron app

### CI Checks
- Linting
- Type checking
- Unit tests
- Build verification

## Release Process

1. Update version in relevant `package.json` files
2. Update CHANGELOG.md
3. Create release PR from develop → main
4. Tag release: `git tag v1.0.0`
5. Create GitHub Release
6. Deploy to production

## Troubleshooting

### Common Issues

**Issue:** npm install fails
```bash
# Clear cache and try again
npm cache clean --force
npm install
```

**Issue:** Port already in use
```bash
# Find process using port 3000
lsof -i :3000
# Kill process
kill -9 <PID>
```

**Issue:** Prisma client out of sync
```bash
cd backend
npm run prisma:generate
```

## Additional Resources

- [README.md](./README.md) - Project overview
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System architecture
- [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) - User workflows

## Support

For questions or issues:
1. Check existing GitHub issues
2. Create a new issue with detailed description
3. Contact the development team

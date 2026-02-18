# Contributing to Ticket System

Thank you for your interest in contributing to this project!

## Getting Started

1. Clone the repository
2. Install dependencies in each module (backend, frontend, desktop)
3. Set up environment variables from `.env.example` files
4. Read the [README.md](README.md) for project overview

## Branch Strategy

- `main` - production-ready code
- `develop` - development branch
- `feature/` - feature branches
- `bugfix/` - bug fix branches
- `hotfix/` - urgent production fixes

### Example:
```bash
git checkout -b feature/ticket-creation
git checkout -b bugfix/auth-issue
```

## Commit Messages

Follow conventional commits format:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `style:` code style changes
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance tasks

### Example:
```
feat: Add ticket priority sorting
fix: Resolve QR code generation issue
docs: Update installation guide
```

## Development Process

1. Create a feature branch from `develop`
2. Make your changes
3. Run tests (if applicable)
4. Create a Pull Request with a clear description
5. Wait for review and approval
6. Merge to `develop` after approval

## Project Structure

```
├── backend/         - NestJS API server
├── frontend/        - Next.js web application
├── desktop/         - Electron desktop application
├── ios/             - iOS application
├── docs/            - Documentation
└── scripts/         - Build and utility scripts
```

## Code Guidelines

- Use TypeScript for new code
- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Add comments for complex logic
- Keep functions small and focused

## Questions?

Feel free to open an issue or contact the team.

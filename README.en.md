# OpenTicket

**Language:** [Polski](/README.md) | English

OpenTicket is a modern ticketing system for small and mid-size electronics service shops. It focuses on fast day-to-day operations, stable runtime behavior, and simple onboarding.

## Version
- **Release line:** `0.5 pre-alpha`
- **SemVer:** `0.5.1-pre-alpha`
- **Status:** active product milestone (macOS app + WebUI + Windows installer)

## Core value for service teams
1. Fast ticket intake with customer/device details and photo attachments.
2. End-to-end repair workflow with stages, comments, and cost breakdown.
3. User personalization: saved filters, themes, and dashboard layout.
4. Admin toolkit: configuration, backup/restore, server diagnostics, quick repair actions.
5. Ready-to-send installers for customers (`.pkg`, `.dmg`, `.exe`) + uninstaller.

## Technology
- **Backend:** NestJS, Prisma ORM, SQLite runtime, TypeScript
- **WebUI:** Next.js 14, TypeScript
- **Desktop:** Electron
- **E2E/UI testing:** Playwright
- **Distribution:** electron-builder + GitHub Releases updater metadata

## UI gallery
See full UI catalog with function descriptions:
- [UI Showcase PL](/docs/UI_SHOWCASE_PL.md)

## Quickstart (DEV)
```bash
cd /Users/icex/Projekty/git_repos/OpenTicket-clean
make test
./Moj/testy/smoke.sh
./Moj/testy/auth-smoke.sh
./Moj/testy/live-3-suite.sh
```

## Build and release
```bash
./Moj/build-oficjalna-instalka.sh
./Moj/build-oficjalna-instalka-win.sh
./Moj/publish-release.sh
```

## Remote host support
- Linux Docker: `/deploy/docker/install.sh`
- Linux native systemd: `/deploy/native/install.sh`
- Synology guide: `/docs/REMOTE_INSTALL_SYNOLOGY.md`

## Quality validation
- Full regression: `16/16 PASS`
- Live policy suite: `3/3 PASS`

Reports:
- `/docs/test-reports/full-regression-20260301-203414/SUMMARY.md`
- `/docs/test-reports/live-3-20260301-205513/SUMMARY.md`

## Documentation
- [iOS Development Plan](/docs/IOS_DEVELOPMENT_PLAN.md)
- [CHANGELOG](/CHANGELOG.md)
- [Security Test Plan](/docs/SECURITY_TEST_PLAN.md)
- [Security Report](/docs/SECURITY_AGENT_REPORT_2026-02-27.md)
- [Dependency Deep Check](/docs/DEPENDENCY_DEEP_CHECK_2026-02-28.md)

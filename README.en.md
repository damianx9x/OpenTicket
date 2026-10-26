# OpenTicket

### Repair tickets from device intake to completed service

A ticket management project for small and mid-size electronics repair shops. Customer and device information, repair stages, comments and costs, with web and desktop interfaces.

[Releases](https://github.com/damianx9x/OpenTicket/releases) · [UI gallery](docs/UI_SHOWCASE_PL.md) · [Development](DEVELOPMENT.md) · [Contributing](CONTRIBUTING.md) · [Polski](README.md)

![OpenTicket dashboard](docs/screenshots/v0.5-pre-alpha/dashboard-demo-helpdesk.png)

## Scope

- Ticket intake with customer details, device information and photos.
- Repair stages, comments, costs and ticket history.
- Operator filters, view preferences and themes.
- Administration, roles, diagnostics and backup/recovery features.
- Local server/client, client-only and remote-host workflows.

## Project status

The default branch is `develop`; backend, frontend and desktop package versions are `0.5.2-pre-alpha`. The latest stable GitHub Release observed on 26 October 2026 is `v0.4.1`. Development code and published installers may differ. Validate the chosen build and recovery procedure before using real data.

## Downloads

- [macOS PKG](https://github.com/damianx9x/OpenTicket/releases/latest/download/OpenTicket-Installer.pkg)
- [Windows EXE](https://github.com/damianx9x/OpenTicket/releases/latest/download/OpenTicket-Installer.exe)
- [All releases and checksums](https://github.com/damianx9x/OpenTicket/releases)

## Code and documentation

| Directory | Responsibility |
| :--- | :--- |
| [backend/](backend/) | NestJS, TypeScript, Prisma, SQLite runtime |
| [frontend/](frontend/) | Next.js, React, TypeScript |
| [desktop/](desktop/) | Electron and packaging |
| [ios/](ios/) | Separate iOS module; see the development plan |
| [deploy/](deploy/) | Remote-host installation scripts |
| [docs/](docs/) | Guides, screenshots and historical reports |

Start with [DEVELOPMENT.md](DEVELOPMENT.md) for source setup, [BUILD.md](BUILD.md) for packaging, or the [remote-host quickstart](docs/REMOTE_INSTALL_QUICKSTART_PL.md). `make test` builds three modules; runtime smoke checks are separate. Historical reports are not a current cross-platform test guarantee.

## License

The source is public. This branch currently has no LICENSE file; the author still needs to approve an open-source license.

---

[Damian Eron](https://github.com/damianx9x) · [Portfolio](https://github.com/damianx9x/damianx9x)

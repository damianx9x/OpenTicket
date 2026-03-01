# Changelog

## v0.4.1 (Milestone 0.41) - 2026-03-01

### Stabilizacja i jakość
- Przeprowadzono pełną regresję release: `16/16 PASS`.
- Przeprowadzono zestaw testów live policy: `3/3 PASS`.
- Zweryfikowano scenariusze kluczowe: setup, auth, backup/restore, klient↔serwer, random UI, print, security, dependency checks.

### Release i instalatory
- Zbudowano i odświeżono artefakty:
  - `OpenTicket-Installer.pkg`,
  - `OpenTicket-Uninstaller.pkg`,
  - `OpenTicket-Installer.dmg`,
  - `OpenTicket-Installer.exe`,
  - `OpenTicket-Portable.exe`,
  - `latest-mac.yml`, `latest.yml`.
- Utrzymano politykę publikacji z automatycznym linkowaniem instalatorów w `README.md`.

### UI i dokumentacja
- Odświeżono screenshoty release do `docs/screenshots/v0.4.1/`.
- Uporządkowano i uproszczono główną dokumentację pod odbiorcę końcowego.
- Dodano ten changelog jako stały punkt odniesienia dla milestone'ów.

### Technologia
- Backend: NestJS + Prisma + SQLite.
- Frontend: Next.js (WebUI).
- Desktop: Electron.
- Remote host: Docker Linux/Synology + native systemd.

### Uwagi kompatybilności
- Brak zmian łamiących kontrakty API v1.
- Zachowana zgodność lokalnego trybu pracy i trybu zdalnego.

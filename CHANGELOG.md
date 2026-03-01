# Changelog

## v0.5.0-pre-alpha - 2026-03-01

### Milestone productowy
- Podniesiono wersję aplikacji do `0.5.0-pre-alpha` (backend/frontend/desktop).
- Przygotowano linię release `0.5 pre-alpha` gotową do testów klientowskich.

### Audyt i porządki
- Wykonano pełny audyt techniczny (regresja, bezpieczeństwo, zależności, flow użytkownika).
- Usunięto zalegające artefakty testowe/śmieci z bieżącego drzewa roboczego.
- Zachowano pełną kompatybilność trybów: local + client_only + remote host.

### Dokumentacja i promocja
- Przepisano główne README na wersję bardziej produktową (PL).
- Dodano wersję angielską: `README.en.md`.
- Dodano pełny katalog UI: `docs/UI_SHOWCASE_PL.md`.
- Odświeżono katalog screenshotów i opisy pod wersję `v0.5-pre-alpha`.

### Screenshoty i demo
- Wygenerowano nowy komplet screenshotów na bazie demo (`500` zgłoszeń):
  - setup 1-4,
  - dashboard + filtry,
  - modal zgłoszenia,
  - statystyki,
  - użytkownicy,
  - konfiguracja,
  - serwer,
  - motywy (Graphite/Emerald/Cupertino).

### Release tooling
- `Moj/publish-release.sh` automatycznie oznacza wydania pre-release dla wersji `alpha/beta/rc/pre`.

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

### Technologia
- Backend: NestJS + Prisma + SQLite.
- Frontend: Next.js (WebUI).
- Desktop: Electron.
- Remote host: Docker Linux/Synology + native systemd.

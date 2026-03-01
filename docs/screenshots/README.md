# Screenshot Catalog

Zrzuty ekranu do README i release notes są wersjonowane katalogami:
- `docs/screenshots/v0.4.1/` — aktualny zestaw dla milestone `v0.4.1`.
- `docs/screenshots/v0.4/` — poprzedni zestaw release.
- `docs/screenshots/v0.3/` — archiwum.

## Standard jakości
- Minimum `1280x720`.
- Brak danych wrażliwych (sekrety, tokeny, dane prywatne klientów).
- Stabilne nazwy plików (np. `dashboard-chromium.png`).
- Każdy release odświeża minimum:
  - dashboard,
  - modal zgłoszenia,
  - statystyki,
  - użytkowników,
  - konfigurację,
  - status serwera.

## Aktualny zestaw (`v0.4.1`)
- `dashboard-chromium.png`
- `dashboard-cupertino-chromium.png`
- `ticket-modal-chromium.png`
- `statistics-chromium.png`
- `users-chromium.png`
- `settings-chromium.png`
- `server-chromium.png`

## Aktualizacja screenshotów
```bash
DEMO_COUNT=500 SCREENSHOT_VERSION=v0.4.1 ./Moj/testy/capture-release-screenshots.sh
```

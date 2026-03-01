# Screenshot Catalog

Zrzuty ekranu do README i materiałów release są wersjonowane katalogami:
- `docs/screenshots/v0.5-pre-alpha/` — aktualny zestaw dla milestone `0.5 pre-alpha`.
- `docs/screenshots/v0.4.1/` — poprzedni zestaw release.
- `docs/screenshots/v0.4/` i `docs/screenshots/v0.3/` — archiwum.

## Standard jakości
- Minimalna rozdzielczość: `1280x720`.
- Brak danych wrażliwych (sekrety, tokeny, prywatne dane klientów).
- Stabilne, opisowe nazwy plików.
- Każdy release odświeża minimum:
  - setup,
  - dashboard,
  - modal zgłoszenia,
  - statystyki,
  - użytkowników,
  - konfigurację,
  - status serwera,
  - motywy kolorystyczne.

## Aktualny zestaw (`v0.5-pre-alpha`)
- `setup-step1-demo.png`
- `setup-step2-admin.png`
- `setup-step3-review.png`
- `setup-step4-complete.png`
- `dashboard-demo-helpdesk.png`
- `dashboard-filters-preset.png`
- `dashboard-theme-graphite.png`
- `dashboard-theme-emerald.png`
- `dashboard-theme-cupertino.png`
- `dashboard-chromium.png`
- `dashboard-cupertino-chromium.png`
- `ticket-modal-chromium.png`
- `statistics-chromium.png`
- `users-chromium.png`
- `settings-chromium.png`
- `settings-logo-custom.png`
- `server-chromium.png`
- `server-status-after-install.png`

## Generowanie screenshotów
```bash
DEMO_COUNT=500 SCREENSHOT_VERSION=v0.5-pre-alpha ./Moj/testy/full-install-usage-smoke.sh
DEMO_COUNT=500 SCREENSHOT_VERSION=v0.5-pre-alpha ./Moj/testy/capture-release-screenshots.sh
```

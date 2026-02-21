# Moj/testy - test bez instalacji (symulacja zainstalowanego systemu)

To uruchamia backend + WebUI w trybie podobnym do instalacji, ale bez instalowania `.pkg`.

## Start
```bash
cd <repo-root>
./Moj/testy/start.sh
```

## Start bez auto-otwierania przeglądarki
```bash
./Moj/testy/start.sh --no-open
```

## Start od zera (zawsze pokazuj setup)
```bash
./Moj/testy/start.sh --fresh
```

## Smoke test (5/5)
```bash
./Moj/testy/smoke.sh
```
Domyślnie smoke odpala się w trybie `fresh` (pełny reset + czyszczenie cache builda), czyli jak pierwszy start u klienta.
Jeśli chcesz test bez resetu:
```bash
./Moj/testy/smoke.sh --no-fresh
```

## Auth smoke (admin + self-signup technika)
```bash
./Moj/testy/auth-smoke.sh
```
Wersja bez resetu:
```bash
./Moj/testy/auth-smoke.sh --no-fresh
```

## Diagnostyka
```bash
./Moj/testy/diagnose.sh
```

## Real-life test UI (10 losowych akcji menu)
Wymagane jednorazowo:
```bash
npm --prefix frontend install --save-dev playwright
npx --prefix frontend playwright install chromium webkit
```
Potem:
```bash
./Moj/testy/ui-random-10.sh
```
Wersja Chromium + WebKit (Safari-like):
```bash
./Moj/testy/ui-random-10.sh --all-browsers
```
Raporty trafiają do:
```bash
./Moj/testy/runtime/reports/ui-random-10-*.json
```
Przy błędzie skrypt zapisuje też screenshot `...-FAIL-*.png`.

## Test modala zgłoszenia (save/discard/cancel)
```bash
./Moj/testy/modal-popup-smoke.sh
```
Zakres:
- otwarcie popupu szczegółów zgłoszenia,
- zamknięcie przez klik poza popup,
- pytanie o zapis zmian,
- scenariusze `save`, `discard`, `cancel`.

Raport:
```bash
./Moj/testy/runtime/reports/modal-popup-smoke-*.json
```

## Aktualizacja screenshotów release (demo 200)
```bash
./Moj/testy/capture-release-screenshots.sh
```
Aktualizuje:
- `docs/screenshots/v0.3/dashboard-chromium.png`
- `docs/screenshots/v0.3/ticket-modal-chromium.png`
- `docs/screenshots/v0.3/statistics-chromium.png`
- `docs/screenshots/v0.3/users-chromium.png`
- `docs/screenshots/v0.3/settings-chromium.png`
- `docs/screenshots/v0.3/server-chromium.png`

## Stop
```bash
./Moj/testy/stop.sh
```

## Reset danych testowych
```bash
APP_ENV=DEV_LOCAL ./Moj/testy/reset.sh
```
Reset czyści:
- konfigurację i dane testowe (`state/`),
- logi/PID/raporty (`runtime/`),
- cache builda (`frontend/.next`, `frontend/out`, `backend/dist`),
- profil testowej przeglądarki (`runtime/browser-profile`),
- artefakty sesji UI (`.playwright-cli`).

## Otwórz UI w świeżym profilu Chrome (symulacja "pierwszy raz")
```bash
./Moj/testy/open-fresh-browser.sh --reset-profile
```

## Co emuluje
- single-port backend+WebUI: `http://127.0.0.1:<PORT>` (domyślnie `3200`)
- konfiguracja i dane oddzielone do `Moj/testy/runtime/state`
- flow setup -> dashboard jak w świeżej instalacji
- walidację ścieżki danych (`/api/v1/setup/validate-path`) przed przejściem do kolejnego kroku setup
- auto-rebuild backend/frontend, gdy kod źródłowy jest nowszy od `dist/out`
- test klikany UI z losowymi akcjami menu (stabilność flow użytkownika)

## Gdy widzisz \"Loading OpenTicket...\" w pętli
1. Uruchom:
```bash
APP_ENV=DEV_LOCAL ./Moj/testy/reset.sh
./Moj/testy/start.sh
```
albo jednym poleceniem:
```bash
./Moj/testy/start.sh --fresh
```
2. Sprawdź:
```bash
curl -s -X POST http://127.0.0.1:3200/api/v1/setup/status
curl -I http://127.0.0.1:3200/setup
```

## Safari: brak stylu / pusty widok
1. Upewnij się, że otwierasz adres z portem testowym:
```bash
open http://127.0.0.1:3200/setup
```
2. Wykonaj pełny reset i świeży build:
```bash
APP_ENV=DEV_LOCAL ./Moj/testy/reset.sh
./Moj/testy/start.sh --fresh --no-open
./Moj/testy/open-fresh-browser.sh --reset-profile
```
3. Zrób twarde odświeżenie w Safari (`Cmd+Option+R`).

## Safari/WebKit: \"Ładowanie dashboardu...\" trwa zbyt długo
Po poprawce WebUI ma timeout API i nie powinien wisieć bez końca.
Jeśli ekran ładowania trwa dłużej niż ~12s:
```bash
./Moj/testy/diagnose.sh
tail -n 200 ./Moj/testy/runtime/logs/backend.log
```

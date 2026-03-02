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

## Test fizycznego iPhone (USB-C + Xcode)
```bash
./Moj/testy/start-ios-device.sh
```

Co robi:
- uruchamia backend w trybie LAN (`BIND_HOST=0.0.0.0`),
- włącza CORS dla prywatnej sieci LAN,
- wypisuje gotowy adres API do wpisania w aplikacji iOS.

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

## Test profilu użytkownika (motyw + compact + trwałość ustawień)
```bash
./Moj/testy/profile-ui-smoke.sh
```
Zakres:
- wejście do zakładki `Mój interfejs`,
- zmiana motywu i compact mode,
- reload dashboardu,
- walidacja, że preferencje zostały zapisane na koncie.

Raport:
```bash
./Moj/testy/runtime/reports/profile-ui-smoke-*.json
```

## Test eksportu backupu z UI
```bash
./Moj/testy/backup-ui-smoke.sh
```
Zakres:
- przejście do `Konfiguracja -> Backup i odtwarzanie`,
- klik `Eksportuj backup`,
- walidacja ścieżki i obecności pliku `.otbackup`.

Raport:
```bash
./Moj/testy/runtime/reports/backup-ui-smoke-*.json
```

## Test auto-backupu (interwał + rotacja current/previous)
```bash
./Moj/testy/auto-backup-smoke.sh
```
Zakres:
- setup z konfiguracją auto-backupu,
- odczyt statusu auto-backupu przez API,
- 2x uruchomienie auto-backupu,
- walidacja rotacji (`openticket-auto-backup.current.otbackup` + `.previous.otbackup`).

## Test integralności backupu (.otbackup + klucz)
```bash
./Moj/testy/backup-verify-smoke.sh
```
Zakres:
- setup od zera + wygenerowanie klucza backupu,
- eksport `.otbackup`,
- weryfikacja integralności przez API (`/system/backup/verify-path`) z poprawnym kluczem,
- kontrola błędu dla złego klucza.

Raport:
```bash
./Moj/testy/runtime/reports/backup-verify-smoke-*.json
```

## Test klient→serwer (osobne runtime)
```bash
./Moj/testy/client-connect-installed-server.sh
```
Zakres:
- start instancji serwera i instancji klienta na osobnych portach,
- setup serwera + utworzenie zgłoszenia,
- setup klienta w trybie `client_only`,
- logowanie przez UI klienta i walidacja, że widzi dane z serwera.

## Test drukowania raportu statystyk (bez popup-blockera)
```bash
./Moj/testy/print-report-smoke.sh
```
Zakres:
- wejście do zakładki `Statystyki`,
- klik `Raport PDF`,
- weryfikacja, że nie pojawia się błąd blokady popupu.

Raport:
```bash
./Moj/testy/runtime/reports/print-report-smoke-*.json
```

## Test backupu przy niestandardowej ścieżce (Application Support)
```bash
./Moj/testy/custom-path-backup-smoke.sh
```
Zakres:
- setup na ścieżce z przestrzeniami (`~/Library/Application Support/...`),
- logowanie admina po setupie (bez restartu aplikacji),
- eksport backupu `.tar.gz`.

Raport:
```bash
./Moj/testy/runtime/reports/custom-path-backup-smoke-*.json
```

## Test regresji setup/login po restarcie i usunięciu bazy
```bash
./Moj/testy/setup-state-regression-smoke.sh
```
Zakres:
- setup od zera + login admina,
- export + import backupu (ścieżka, która wcześniej czyściła cache i psuła `setupMode`),
- próba przełączenia na `client_only` po konfiguracji (musi być zablokowana),
- ręczne usunięcie `app.db` i weryfikacja, że system wraca do setupu (bez „martwego” ekranu logowania).

Raport:
```bash
./Moj/testy/runtime/reports/setup-state-regression-smoke-*.json
```

## Test stabilności 10x od zera (fresh + random UI)
```bash
./Moj/testy/fresh-10x-smoke.sh
```
Opcjonalnie inna przeglądarka:
```bash
BROWSER=webkit ./Moj/testy/fresh-10x-smoke.sh
```

## Pełny test instalacji i użycia (setup + demo + motywy + logo + filtry)
```bash
./Moj/testy/full-install-usage-smoke.sh
```
Zakres:
- pełny setup wizard na czysto z trybem `demo_dataset`,
- automatyczne przejście do dashboardu po setupie,
- zapis i wczytanie presetu filtrów,
- przełączenie motywów (`graphite`, `emerald`, `cupertino`),
- upload i zapis własnego logo firmy,
- weryfikacja zakładki `Serwer`.

Raport:
```bash
./Moj/testy/runtime/reports/full-install-usage-smoke-*.json
```

Screenshoty:
- `docs/screenshots/v0.4/setup-step1-demo.png`
- `docs/screenshots/v0.4/setup-step2-admin.png`
- `docs/screenshots/v0.4/setup-step3-review.png`
- `docs/screenshots/v0.4/setup-step4-complete.png`
- `docs/screenshots/v0.4/dashboard-theme-graphite.png`
- `docs/screenshots/v0.4/dashboard-theme-emerald.png`
- `docs/screenshots/v0.4/dashboard-theme-cupertino.png`
- `docs/screenshots/v0.4/settings-logo-custom.png`
- `docs/screenshots/v0.4/dashboard-filters-preset.png`

## Pełna macierz regresji (archiwizuje logi i raporty)
```bash
./Moj/testy/full-regression-suite.sh
```
Wynik zapisuje się do:
```bash
docs/test-reports/full-regression-<timestamp>/SUMMARY.md
```

## Live policy (3 scenariusze)
Główne testy „na żywym organizmie” są ograniczone do 3 scenariuszy:
```bash
./Moj/testy/live-3-suite.sh
```
Scenariusze:
1. świeża instalacja + setup + realne użycie,
2. klient łączy się do działającego serwera,
3. disaster restore z backupu.

## Aktualizacja screenshotów release (demo 500)
```bash
./Moj/testy/capture-release-screenshots.sh
```
Aktualizuje:
- `docs/screenshots/v0.4/dashboard-chromium.png`
- `docs/screenshots/v0.4/ticket-modal-chromium.png`
- `docs/screenshots/v0.4/statistics-chromium.png`
- `docs/screenshots/v0.4/users-chromium.png`
- `docs/screenshots/v0.4/settings-chromium.png`
- `docs/screenshots/v0.4/server-chromium.png`

Do wymuszenia innej liczby rekordów demo / folderu screenshotów:
```bash
DEMO_COUNT=500 SCREENSHOT_VERSION=v0.4 ./Moj/testy/capture-release-screenshots.sh
DEMO_COUNT=500 SCREENSHOT_VERSION=v0.4 ./Moj/testy/full-install-usage-smoke.sh
```

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

# Status Implementacji Planu

Notatka badawcza jest teraz traktowana jako formalne źródło wymagań i ma mapowanie wykonawcze:
- `docs/REQUIREMENTS-2026-02-20.md`
- `docs/RESEARCH-ALIGNMENT.md`

## Etap 0 — Stabilizacja repo
- Status: `DONE`
- Wynik: repo robocze działa jako standardowy checkout.
- Artefakty: `docs/BASELINE.md`, zaktualizowany `README.md`.

## Etap 1 — Backend/API
- Status: `DONE`
- Zmiany:
  - backend kompiluje się (`npm --prefix backend run build`),
  - aktywne endpointy zdrowia/systemu/diagnostyki,
  - poprawione DTO i kompatybilność payloadów,
  - poprawione moduły QR/provision/pairing.
- Testy 5/5:
  - `T1_build=PASS`
  - `T2_health=PASS`
  - `T3_create=PASS`
  - `T4_list_meta=PASS`
  - `T5_diag_db=PASS`

## Etap 2 — Deterministyczny cykl start/stop/reset/diagnose
- Status: `DONE`
- Zmiany:
  - dodane `scripts/up.sh`, `scripts/stop.sh`, `scripts/reset.sh`, `scripts/diagnose.sh`, `scripts/smoke.sh`,
  - dodany `Makefile` (`up/down/reset/diagnose/test/smoke/desktop-dev`),
  - port fallback przy konflikcie,
  - `scripts/up.sh` uruchamia backend stabilnie przez `node backend/dist/main.js` (+ auto-build),
  - `scripts/smoke.sh` auto-startuje usługi, gdy backend jest wyłączony,
  - ochrona resetu (`APP_ENV=DEV_LOCAL`).
- Testy 5/5:
  - `T1_up_health=PASS`
  - `T2_down_releases_ports=PASS`
  - `T3_reset_block_non_dev=PASS`
  - `T4_reset_dev_reinit=PASS`
  - `T5_setup_after_reset=PASS`

## Etap 3 — Spięcie WebUI↔API
- Status: `DONE`
- Zrobione:
  - `NEXT_PUBLIC_API_URL` + jeden klient API z poprawnym odpakowaniem `data/meta`,
  - poprawki setup flow (`/`, `/setup`, `/dashboard`) i kontraktów odpowiedzi,
  - dashboard operacyjny na realnym API: ticket + komentarz + koszt (bez local store),
  - naprawa DTO `ticketId` (z URL path) dla komentarzy i kosztów,
  - auto-seed stawek VAT przy setupie + self-heal w cost service,
  - skrypt testowy `scripts/stage3-go-no-go.sh` + `make stage3-test`.
- Testy 5/5:
  - `T1_front_dashboard=PASS`
  - `T2_create_ticket=PASS`
  - `T3_add_comment=PASS`
  - `T4_add_cost=PASS`
  - `T5_list_ticket_meta=PASS`

## Etap 7 — Instalator macOS (część)
- Status: `IN_PROGRESS`
- Zrobione:
  - folder `Moj/` z gotowym workflow testowym:
    - `Moj/build-oficjalna-instalka.sh`
    - `Moj/install-local.sh`
    - `Moj/deinstaluj-openticket.sh`
  - generowanie artefaktów:
    - `Moj/OpenTicket-Installer.pkg`
    - `Moj/OpenTicket-Installer.dmg`
    - `Moj/OpenTicket-Installer.zip`
  - sumy kontrolne SHA256 dla instalek.
  - naprawa błędu runtime `spawn node ENOENT`:
    - backend uruchamiany przez `process.execPath` + `ELECTRON_RUN_AS_NODE` (bez zależności od systemowego `node`),
    - backend/frontend dodane do `extraResources` w paczce desktop.
  - dodany tryb testów bez instalacji: `Moj/testy/*` (start/stop/reset/diagnose/smoke).
  - naprawiony static routing dla stron setup/dashboard (`extensions: ['html']` + korekta `exclude`), co usuwa `Cannot GET /setup`.
  - `Moj/testy/start.sh` przebudowuje artefakty gdy kod jest nowszy od builda.
  - `Moj/testy/start.sh --fresh` resetuje dane i wymusza świeży setup.
  - `/api/v1/setup/dev-reset` + ekran `/setup` z resetem DEV (bez konieczności IPC/Electron).
  - `/api/v1/setup/validate-path` + walidacja zapisu/uprawnień w kroku wyboru lokalizacji.
  - poprawiony fallback webowy dla wyboru folderu (komunikat inline zamiast blokującego popupu).
  - dodany fallback CSS w layout, żeby formularze i przyciski były czytelne nawet przy problemie z cache CSS.
  - dodana odporność setup na `Schema engine error` w kroku inicjalizacji (retry + fallback URL dla Prisma db push).
  - auto-migracja DB przy starcie (`TICKET_SYSTEM_AUTO_MIGRATE=1`) dla scenariusza upgrade.
  - deinstalator rozszerzony o pełne czyszczenie danych/logów/cache/preferences/launch agents/receipts.
- Testy 5/5 (pakiet + test harness):
  - `T1_packaged_no_enoent=PASS`
  - `T2_packaged_backend_ready_log=PASS`
  - `T3_setup_route_works=PASS`
  - `T4_setup_dev_reset_button=PASS`
  - `T5_moj_testy_smoke=PASS`
- Pozostało:
  - podpis Apple Developer ID + notaryzacja (build-time/release-time),
  - finalny UX pierwszego uruchomienia dla klienta sklepu,
  - końcowy test na czystym systemie klienta (fresh install + upgrade).

## Etap 4 — Desktop/WebUI UX i diagnostyka (część)
- Status: `IN_PROGRESS`
- Zrobione:
  - auto-logowanie po setupie (admin tworzony w kroku 2 od razu dostaje sesję po kroku 4),
  - fallback do `/login?email=...` jeśli auto-login nie powiedzie się,
  - wzmocniona obsługa localStorage (Safari/WebKit privacy-safe),
  - konfiguracja firmy: upload logo + podgląd,
  - rozbudowany profil użytkownika:
    - szybkie presety filtrów,
    - filtry zaawansowane (`kanał`, `przypisanie`, `załączniki`, `komentarze`, `zakres dat`),
    - 3 motywy kolorystyczne (`Helpdesk Blue`, `Graphite Noir`, `Emerald Flow`),
  - katalog pozycji kosztorysu (admin + dropdown z auto-uzupełnianiem w popupie zgłoszenia),
  - testy kanałów e-mail/SMS z czytelnym komunikatem sukces/błąd w UI.
- Testy:
  - `setup -> login/dashboard` (manual + Playwright) = `PASS`,
  - `10 losowych akcji menu` (Chromium) = `PASS`,
  - `10 losowych akcji menu` (WebKit/Safari-like) = `PASS`.

## Etap 8 — Hardening (część)
- Status: `IN_PROGRESS`
- Zrobione:
  - endpointy ticketów/komentarzy/kosztów wymagają teraz tokenu i ról (`ADMIN/AGENT/REPORTER/VIEWER` wg operacji),
  - endpointy załączników wymagają auth + role i walidację MIME/rozszerzenia/rozmiaru,
  - endpointy `diagnostics/*` ograniczone do roli `ADMIN`,
  - backend ma `helmet` + CORS allowlist + rate limiting (`auth/login`, `setup/*`, `tickets/status/:token`),
  - smoke testy zaktualizowane do realnego logowania (brak anonimowych zapisów),
  - automatyczny test UI random 10 (`Moj/testy/ui-random-10.sh`) + raport JSON/screenshot FAIL.
- Pozostało:
  - rate limiting,
  - ograniczenie CORS do docelowych originów,
  - finalna polityka auth dla iOS QR/public portal.

## Etapy 4-8
- Status: `PARTIAL`
- Zakres otwarty: desktop DEV screen + support mail, iOS MVP (ticket + foto + QR), podpisany QR + PDF etykiety, pełny hardening/security.

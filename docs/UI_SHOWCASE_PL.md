# OpenTicket - Showcase UI (v0.5 pre-alpha)

Ten dokument pokazuje wszystkie główne zakładki i funkcje produktu na bazie demo (`500` zgłoszeń), razem z opisem biznesowym i mapowaniem do API.

## 1) Setup Wizard (pierwsze uruchomienie)

### Krok 1 - wybór źródła danych i trybu instalacji
![Setup Step 1](/docs/screenshots/v0.5-pre-alpha/setup-step1-demo.png)

Funkcje:
- `Serwer + klient` / `Sam klient`.
- Nowa baza / import istniejącej bazy / import backupu / baza demo.
- Konfiguracja auto-backupu (folder + interwał).

API:
- `POST /api/v1/setup/status`
- `POST /api/v1/setup/validate-path`
- `POST /api/v1/setup/discover-servers`
- `POST /api/v1/setup/validate-remote`
- `POST /api/v1/setup/token/claim`

### Krok 2 - admin i organizacja
![Setup Step 2](/docs/screenshots/v0.5-pre-alpha/setup-step2-admin.png)

API:
- `POST /api/v1/setup/init`

### Krok 3 - podsumowanie i inicjalizacja
![Setup Step 3](/docs/screenshots/v0.5-pre-alpha/setup-step3-review.png)

### Krok 4 - finalizacja i QR parowania
![Setup Step 4](/docs/screenshots/v0.5-pre-alpha/setup-step4-complete.png)

---

## 2) Dashboard zgłoszeń

### Widok główny (demo)
![Dashboard Demo](/docs/screenshots/v0.5-pre-alpha/dashboard-demo-helpdesk.png)

Funkcje:
- szybkie KPI (otwarte, pilne, w toku, zamknięte),
- wyszukiwarka wielopolowa (temat, #numer, treść, klient),
- zaawansowane filtry: status, priorytet, kanał, przypisanie, daty, załączniki, komentarze,
- presety filtrów użytkownika (zapisz/wybierz/ustaw domyślny),
- otwieranie zgłoszenia w modalu.

API:
- `GET /api/v1/tickets`
- `POST /api/v1/tickets`
- `GET /api/v1/statistics/overview`
- `PATCH /api/v1/users/me/preferences`

### Presety filtrów
![Filters Preset](/docs/screenshots/v0.5-pre-alpha/dashboard-filters-preset.png)

---

## 3) Szczegóły zgłoszenia (modal)
![Ticket Modal](/docs/screenshots/v0.5-pre-alpha/ticket-modal-chromium.png)

Funkcje:
- pełny opis usterki,
- etapy procesu i historia etapów,
- przypisanie technika,
- komentarze wewnętrzne i publiczne,
- koszty i podsumowanie,
- historia klienta,
- obsługa zdjęć i załączników.

API:
- `GET /api/v1/tickets/:id`
- `PATCH /api/v1/tickets/:id`
- `GET /api/v1/tickets/:id/customer-history`
- `GET/POST /api/v1/tickets/:id/comments`
- `GET/POST /api/v1/tickets/:id/cost-items`
- `GET/POST /api/v1/tickets/:id/attachments`

---

## 4) Zakładka Statystyki
![Statistics](/docs/screenshots/v0.5-pre-alpha/statistics-chromium.png)

Funkcje:
- przekroje po statusach, priorytetach, kanałach,
- trendy i podsumowania,
- filtry raportowe,
- eksport raportu PDF.

API:
- `GET /api/v1/statistics/overview`

---

## 5) Zakładka Użytkownicy
![Users](/docs/screenshots/v0.5-pre-alpha/users-chromium.png)

Funkcje:
- lista użytkowników (styl kontaktów),
- role i edycja profilu,
- notatki wewnętrzne per użytkownik,
- ustawienia UI i filtrów per konto.

API:
- `GET/POST/PATCH /api/v1/users`
- `GET/POST /api/v1/users/:id/notes`
- `GET/PATCH /api/v1/users/me/preferences`
- `POST /api/v1/users/register-technician`

---

## 6) Zakładka Konfiguracja
![Settings](/docs/screenshots/v0.5-pre-alpha/settings-chromium.png)
![Settings Logo](/docs/screenshots/v0.5-pre-alpha/settings-logo-custom.png)

Funkcje:
- branding (nazwa firmy, logo),
- język i domyślne opcje UI,
- konfiguracja kanałów (mail/SMS),
- backup i restore,
- katalog kosztów (pozycje pod szybkie kosztorysy).

API:
- `GET /api/v1/settings/public`
- `GET /api/v1/settings/admin`
- `PATCH /api/v1/settings/admin`
- `GET/PATCH /api/v1/settings/cost-catalog`
- `POST /api/v1/notifications/test/email`
- `POST /api/v1/notifications/test/sms`
- `POST /api/v1/system/backup/export`
- `POST /api/v1/system/backup/import`
- `POST /api/v1/system/backup/verify`

---

## 7) Zakładka Serwer
![Server](/docs/screenshots/v0.5-pre-alpha/server-chromium.png)
![Server After Install](/docs/screenshots/v0.5-pre-alpha/server-status-after-install.png)

Funkcje:
- healthcheck i informacje środowiskowe,
- status bazy danych,
- raport diagnostyczny,
- narzędzia naprawcze (restart/quick-fix z desktopu).

API:
- `GET /api/v1/health`
- `GET /api/v1/system/info`
- `GET /api/v1/diagnostics`
- `GET /api/v1/diagnostics/report`
- `GET /api/v1/diagnostics/metrics`

---

## 8) Motywy kolorystyczne

### Graphite Noir
![Theme Graphite](/docs/screenshots/v0.5-pre-alpha/dashboard-theme-graphite.png)

### Emerald Flow
![Theme Emerald](/docs/screenshots/v0.5-pre-alpha/dashboard-theme-emerald.png)

### Cupertino Glass
![Theme Cupertino](/docs/screenshots/v0.5-pre-alpha/dashboard-theme-cupertino.png)

Funkcje:
- motywy per użytkownik,
- trwałe ustawienia interfejsu i filtrów,
- szybkie przełączanie bez restartu.

API:
- `GET/PATCH /api/v1/users/me/preferences`

---

## Źródło screenshotów
Screenshoty wygenerowane automatycznie przez testy E2E:
```bash
DEMO_COUNT=500 SCREENSHOT_VERSION=v0.5-pre-alpha ./Moj/testy/full-install-usage-smoke.sh
DEMO_COUNT=500 SCREENSHOT_VERSION=v0.5-pre-alpha ./Moj/testy/capture-release-screenshots.sh
```

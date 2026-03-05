# OpenTicket
<!-- INSTALLER_LINK:START -->
## Installers (macOS + Windows)
- macOS PKG (latest): [OpenTicket-Installer.pkg](https://github.com/damianx9x/OpenTicket/releases/latest/download/OpenTicket-Installer.pkg)
- macOS PKG (v0.5.2-pre-alpha): [OpenTicket-Installer.pkg](https://github.com/damianx9x/OpenTicket/releases/download/v0.5.2-pre-alpha/OpenTicket-Installer.pkg)
- Windows EXE (latest): [OpenTicket-Installer.exe](https://github.com/damianx9x/OpenTicket/releases/latest/download/OpenTicket-Installer.exe)
- Windows EXE (v0.5.2-pre-alpha): [OpenTicket-Installer.exe](https://github.com/damianx9x/OpenTicket/releases/download/v0.5.2-pre-alpha/OpenTicket-Installer.exe)
<!-- INSTALLER_LINK:END -->

**Język:** Polski (domyślnie) | [English](/README.en.md)

OpenTicket to system ticketowy dla małych i średnich serwisów elektroniki. Priorytetem jest szybkość pracy operatora, stabilność działania i prosty onboarding klienta końcowego.

## Wersja
- **Release line:** `0.5 pre-alpha`
- **SemVer:** `0.5.1-pre-alpha`
- **Status:** aktywny milestone produktowy (macOS + WebUI + Windows installer)

## Co dostajesz w produkcie
1. Przyjęcie zgłoszenia w kilka sekund (klient, urządzenie, opis, zdjęcia).
2. Pełny workflow serwisowy: etapy, komentarze, koszty, historia.
3. Personalizacja operatora: presety filtrów, motywy, układ dashboardu.
4. Narzędzia admina: konfiguracja, backup/restore, status serwera, szybka naprawa.
5. Instalatory gotowe do wysyłki klientowi: `.pkg`, `.dmg`, `.exe`, deinstalator.

## Kluczowe możliwości
- **Tryby pracy:**
  - `Serwer + klient` (lokalnie),
  - `Sam klient` (podpięcie do istniejącego serwera),
  - `Serwer zdalny` (Linux/Synology).
- **Backup i odzyskiwanie:**
  - szyfrowany `.otbackup` (AES-256-GCM),
  - klucz odzyskiwania,
  - auto-backup z rotacją `current/previous`,
  - import w setupie (baza/backup/demo).
- **Bezpieczeństwo operacyjne:**
  - setup token dla hosta zdalnego,
  - role i uprawnienia,
  - audyt i diagnostyka,
  - raporty testów regresji i live.

## Stack technologiczny
- **Backend:** NestJS, Prisma ORM, SQLite (runtime v1), TypeScript
- **Frontend/WebUI:** Next.js 14, TypeScript
- **Desktop app:** Electron
- **Testy E2E/UI:** Playwright
- **Dystrybucja:** electron-builder, GitHub Releases, updater metadata (`latest-mac.yml`, `latest.yml`)

## Galeria UI (v0.5 pre-alpha)
Pełna dokumentacja zakładek i funkcji jest tutaj: [UI Showcase PL](/docs/UI_SHOWCASE_PL.md)

### Setup i onboarding
![Setup Step 1](/docs/screenshots/v0.5-pre-alpha/setup-step1-demo.png)
![Setup Step 4](/docs/screenshots/v0.5-pre-alpha/setup-step4-complete.png)

### Dashboard i workflow
![Dashboard](/docs/screenshots/v0.5-pre-alpha/dashboard-demo-helpdesk.png)
![Ticket Modal](/docs/screenshots/v0.5-pre-alpha/ticket-modal-chromium.png)

### Zakładki operacyjne
![Statistics](/docs/screenshots/v0.5-pre-alpha/statistics-chromium.png)
![Users](/docs/screenshots/v0.5-pre-alpha/users-chromium.png)
![Settings](/docs/screenshots/v0.5-pre-alpha/settings-chromium.png)
![Server](/docs/screenshots/v0.5-pre-alpha/server-chromium.png)

### Motywy kolorystyczne
![Graphite Theme](/docs/screenshots/v0.5-pre-alpha/dashboard-theme-graphite.png)
![Emerald Theme](/docs/screenshots/v0.5-pre-alpha/dashboard-theme-emerald.png)
![Cupertino Theme](/docs/screenshots/v0.5-pre-alpha/dashboard-theme-cupertino.png)

## Quickstart (DEV)
```bash
cd /Users/icex/Projekty/git_repos/OpenTicket-clean
make test
./Moj/testy/smoke.sh
./Moj/testy/auth-smoke.sh
./Moj/testy/live-3-suite.sh
```

## Build i publikacja
```bash
./Moj/build-oficjalna-instalka.sh
./Moj/build-oficjalna-instalka-win.sh
./Moj/publish-release.sh
```

## Instalacja zdalna (host)
- Szybki poradnik krok-po-kroku: `/docs/REMOTE_INSTALL_QUICKSTART_PL.md`
- Linux Docker: `/deploy/docker/install.sh`
- Linux native systemd: `/deploy/native/install.sh`
- Synology: `/docs/REMOTE_INSTALL_SYNOLOGY.md`

Pełne guide:
- `/docs/REMOTE_INSTALL_LINUX.md`
- `/docs/REMOTE_INSTALL_NATIVE_SYSTEMD.md`
- `/docs/REMOTE_INSTALL_SYNOLOGY.md`

## Ostatnia walidacja jakości
- Full regression suite: `16/16 PASS`
  - `/docs/test-reports/full-regression-20260301-203414/SUMMARY.md`
- Live policy suite: `3/3 PASS`
  - `/docs/test-reports/live-3-20260301-205513/SUMMARY.md`

## Dokumentacja
- [UI Showcase PL](/docs/UI_SHOWCASE_PL.md)
- [Plan rozwoju iOS](/docs/IOS_DEVELOPMENT_PLAN.md)
- [Remote Install Quickstart PL](/docs/REMOTE_INSTALL_QUICKSTART_PL.md)
- [Rozszerzone scenariusze testowe](/docs/TEST_SCENARIOS_EXTENDED_2026-03-05.md)
- [CHANGELOG](/CHANGELOG.md)
- [Security Test Plan](/docs/SECURITY_TEST_PLAN.md)
- [Security Report](/docs/SECURITY_AGENT_REPORT_2026-02-27.md)
- [Dependency Deep Check](/docs/DEPENDENCY_DEEP_CHECK_2026-02-28.md)

## Dla właściciela serwisu
OpenTicket jest projektowany tak, by technik mógł pracować od razu po instalacji: mniej klikania, mniej ryzyka utraty danych, więcej kontroli operacyjnej i czytelne statusy dla zespołu oraz klienta.

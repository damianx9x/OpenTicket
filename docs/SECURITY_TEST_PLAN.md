# OpenTicket Security & Cybersecurity Test Plan

## Cel
Plan walidacji bezpieczeństwa przed każdym wydaniem (`pkg`, `dmg`, `exe`) bez psucia UX.

## Zakres
- Backend API (NestJS)
- WebUI
- Desktop (Electron)
- Instalator/aktualizacje
- Backup/import

## Środowiska testowe
1. `DEV_LOCAL` (lokalny test deweloperski)
2. `SHOP_LOCAL` (profil zbliżony do klienta)
3. Czyste konto systemowe macOS (nowy użytkownik)

## Brama bezpieczeństwa release (go/no-go)

### 1) Uwierzytelnianie i autoryzacja (RBAC)
- [ ] ADMIN ma dostęp do `Konfiguracja` i `Serwer`; AGENT nie ma (UI + API 403).
- [ ] Brak tokena => API chronione zwraca 401.
- [ ] Token nieaktywny/po wylogowaniu => 401.
- [ ] Rejestracja technika działa tylko gdy self-signup jest włączony.
- [ ] Reset/reinstall wymaga uprawnień i potwierdzenia.

### 2) Bezpieczeństwo API
- [ ] CORS dopuszcza tylko dozwolone originy (desktop/webui).
- [ ] Rate limit blokuje flood logowania i zapisuje zdarzenie.
- [ ] Walidacja DTO odrzuca niepoprawne payloady (400).
- [ ] Upload zdjęć odrzuca niedozwolone MIME/za duże pliki.
- [ ] Diagnostyka nie wycieka sekretów (tokenów, haseł, pełnych kluczy).

### 3) Integralność danych
- [ ] Backup tworzy jeden plik (DB + uploady + konfiguracja).
- [ ] Import backupu odtwarza użytkowników, tickety, zdjęcia i ustawienia.
- [ ] Import nie pozwala na path traversal.
- [ ] Reset DEV nie działa w produkcyjnym profilu bez flagi.
- [ ] Po restarcie aplikacji logowanie działa na tej samej bazie.

### 4) Desktop/Electron
- [ ] `contextIsolation=true`, `nodeIntegration=false`, sandbox aktywny.
- [ ] Preload wystawia tylko wymagane metody bridge.
- [ ] IPC ma walidację argumentów i obsługę błędów.
- [ ] Restart/repair/factory-reset działa i nie zostawia sierot procesów.
- [ ] Ekran serwera pokazuje czytelne błędy + logi bez PII.

### 5) Instalator, deinstalator, aktualizacje
- [ ] `OpenTicket-Installer.pkg` instaluje app i uruchamia setup assistant.
- [ ] `OpenTicket-Uninstaller.pkg` usuwa aplikację i dane zgodnie z opisem.
- [ ] Auto-update czyta poprawny feed i nie wywraca bazy.
- [ ] Przed aktualizacją wykonywany jest backup bezpieczeństwa.
- [ ] Upgrade nie kasuje danych produkcyjnych.

## Automatyzacja (minimum)
```bash
./Moj/testy/smoke.sh
./Moj/testy/auth-smoke.sh
./Moj/testy/setup-state-regression-smoke.sh
./Moj/testy/ui-random-10.sh --all-browsers
./Moj/testy/diagnose.sh
```

## Testy manualne krytyczne (Apple user flow)
1. Czyste konto macOS -> instalacja `.pkg` -> pełny setup.
2. Logowanie admina, utworzenie technika, logowanie technika.
3. Praca 30+ min: tworzenie/edycja ticketów, komentarze, koszty, zdjęcia.
4. Backup -> restart systemu -> import -> porównanie danych.
5. Aktualizacja aplikacji -> kontrola integralności danych i sesji.

## Kryterium ukończenia
Release jest dopuszczony tylko gdy wszystkie punkty go/no-go są zaliczone oraz testy automatyczne i manualne nie zgłaszają błędów krytycznych.

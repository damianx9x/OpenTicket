# Moj - Oficjalna instalka/deinstalka (OpenTicket)

## 1) Zbuduj instalator
```bash
cd <repo-root>
./Moj/build-oficjalna-instalka.sh
```

Po buildzie dostaniesz w tym folderze:
- `OpenTicket-Installer.pkg` (główny instalator)
- `OpenTicket-Installer.dmg` (opcjonalny backup)
- `OpenTicket-Installer.zip` (opcjonalny backup)
- pliki `*.sha256`

## 2) Zainstaluj (test "na żywym organizmie")
```bash
./Moj/install-local.sh
```

Po pierwszym uruchomieniu, w kreatorze setup (krok 1) wybierasz:
- `Serwer + klient` (pełna instalacja lokalna),
- `Sam klient` (łączenie z już działającym serwerem przez URL API).

W trybie `Sam klient`:
- przycisk `Wyszukaj w LAN` automatycznie szuka serwera w sieci lokalnej,
- możesz użyć `Skan pełny /24` gdy szybkie skanowanie nic nie znajdzie,
- jako alternatywa działa ręczny adres zewnętrzny (`https://...`) + `Sprawdź adres`.

Na ekranie logowania aplikacji desktop są dostępne narzędzia awaryjne:
- `Odśwież status`,
- `Restart silnika`,
- `Szybka naprawa`,
- `Otwórz logi`,
- `Zapisz raport diagnostyczny`.
- `Reset systemu (setup od nowa)` - czyści lokalną konfigurację i bazę, po czym wraca do kreatora setup.

Dodatkowo działa watchdog zdrowia silnika:
- aplikacja sama monitoruje backend i bazę,
- gdy healthcheck przestaje odpowiadać, wykonuje automatyczny restart silnika.

Rejestracja technika nie jest już publiczna na ekranie logowania.
Dodawanie techników odbywa się po zalogowaniu jako `ADMIN` w zakładce `Użytkownicy`.

Jeśli macOS zablokuje uruchomienie (brak podpisu/notaryzacji):
```bash
xattr -dr com.apple.quarantine "/Applications/OpenTicket.app"
open "/Applications/OpenTicket.app"
```

Jeśli wcześniej widziałeś:
- `Failed to start backend: spawn node ENOENT`
- `Failed to start application: Backend did not start in time`

to użyj nowego `.pkg` z tego folderu i przeinstaluj aplikację (stary build był bez pełnego runtime).

## 3) Odinstaluj
```bash
./Moj/deinstaluj-openticket.sh
```
albo bezpośrednio po instalacji:
```bash
open "/Applications/Odinstaluj OpenTicket.command"
```
Skrypt usuwa:
- aplikację z `/Applications`,
- wbudowany deinstalator z `/Applications/Odinstaluj OpenTicket.command`,
- dane i logi z `~/Library/Application Support`, `~/Library/Logs`, `~/Library/Caches`,
- preferencje i saved state,
- launch agents i receipts pakietu (jeśli obecne).

## 4) Test bez instalacji (`Moj/testy`)
```bash
./Moj/testy/start.sh
./Moj/testy/start.sh --no-open
./Moj/testy/start.sh --fresh
./Moj/testy/open-fresh-browser.sh --reset-profile
./Moj/testy/smoke.sh
./Moj/testy/auth-smoke.sh
./Moj/testy/client-only-smoke.sh
./Moj/testy/ui-random-10.sh
./Moj/testy/ui-random-10.sh --all-browsers
./Moj/testy/diagnose.sh
./Moj/testy/stop.sh
APP_ENV=DEV_LOCAL ./Moj/testy/reset.sh
```

Automatyczny test `ui-random-10` wykonuje 10 losowych akcji menu i zapisuje raporty do:
`Moj/testy/runtime/reports/`.

W zakładce `Serwer`:
- `Baza danych` powinna być `OK`,
- `Redis` i `Object storage` w lokalnej instalacji mogą być `NIEAKTYWNE` (to poprawny stan, nie błąd).

Jeśli po czasie pojawia się `Internal server error` przy logowaniu:
1. wejdź na ekran logowania desktop,
2. kliknij `Szybka naprawa`,
3. jeśli błąd zostaje: kliknij `Reset systemu (setup od nowa)` i przejdź setup ponownie.

### Gdy setup zatrzymuje się na kroku 3 (`Schema engine error`)
Uruchom testowy tryb „jak klient od zera”:
```bash
./Moj/testy/start.sh --fresh --no-open
./Moj/testy/open-fresh-browser.sh --reset-profile
```

## Uwagi
- Instalator `.pkg` kopiuje aplikację do `/Applications`.
- Runtime jest lokalny (app + backend + WebUI w pakiecie aplikacji).
- Internet może być potrzebny tylko przy buildzie/release (nie przy samym uruchomieniu aplikacji).

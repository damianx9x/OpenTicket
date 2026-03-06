# OpenTicket iOS (SwiftUI)

Ten katalog to aplikacja iOS dla technika serwisu.

## Co działa teraz
1. Parowanie przez QR lub ręczny URL API.
2. Logowanie (`/api/v1/auth/login`) i token w Keychain.
3. **Unified WebUI (1:1) jako domyślny tryb iOS** - ten sam interfejs co macOS/Windows/Web.
4. Native fallback iOS (Dashboard + Tickets + Settings) jako tryb zapasowy.
5. Lista ticketów z filtrami: status, `Tylko moje`, `> X dni`, fulltext.
6. Dodawanie nowego ticketu z iPhone (`POST /api/v1/tickets`).
7. Szczegóły ticketu z etapami, komentarzami, załącznikami i zmianą etapu (`PATCH /api/v1/tickets/:id`).
8. Motywy UI: `System`, `Cupertino`, `Graphite`, `Emerald`.

## Spójność 1:1 między platformami
W `Ustawienia -> Ekosystem UI` ustaw:
- `Unified WebUI (1:1)` - rekomendowane, identyczny wygląd i logika jak desktop/web,
- `Native iOS` - tryb alternatywny dla testów mobilnych.

## Test na żywym iPhonie (USB-C, krok po kroku)
1. Podłącz iPhone kablem USB-C do Maca i zaakceptuj „Trust this computer”.
2. Uruchom backend + WebUI w trybie iOS LAN:
```bash
cd /Users/icex/Projekty/git_repos/OpenTicket-clean
./Moj/testy/start-ios-device.sh
```
Skrót z pełną walidacją (health + setup):
```bash
./Moj/testy/ios-usb-check.sh
```
3. Skrypt wyświetli gotowe adresy:
- `WebUI (Mac): http://127.0.0.1:3200`
- `API (iPhone): http://<twoje-lan-ip>:3200`
4. W Xcode:
- utwórz projekt typu `iOS App (SwiftUI)` albo użyj istniejącego,
- dodaj pliki z `ios/SwiftUI`,
- ustaw `Signing & Capabilities` (Team),
- wybierz fizyczny iPhone jako target,
- kliknij `Run`.
5. W aplikacji iOS:
- zeskanuj QR z OpenTicket lub wpisz ręcznie URL API,
- zaloguj konto admin/technik,
- przetestuj: dashboard, filtry, nowe zgłoszenie, zmianę etapu.

## Szybki check backend<->iOS
```bash
# backend działa i słucha dla urządzeń LAN
lsof -nP -iTCP:3200 -sTCP:LISTEN

# setup status z Maca
curl -s -X POST http://127.0.0.1:3200/api/v1/setup/status
```

## Najbliższy etap iOS
1. Upload zdjęć do ticketu z `PhotosPicker` + endpoint `tickets/:id/attachments/upload`.
2. Push powiadomienia i przypomnienia technika.
3. Tryb offline queue (kolejka operacji i retry po odzyskaniu sieci).

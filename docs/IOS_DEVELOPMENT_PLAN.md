# OpenTicket iOS - Plan rozwoju (Apple-first)

## Cel
Zbudować aplikację iOS dla technika, która działa szybko na żywym serwisie i jest prosta dla początkującego operatora.

## Założenia v1
1. Backend i baza pozostają w obecnej architekturze OpenTicket.
2. iOS działa jako klient API (bez lokalnej bazy serwera).
3. Priorytet: stabilność + szybkie operacje terenowe (nowe zgłoszenie, zdjęcia, statusy).

## Etap 1 - Stabilne połączenie i logowanie (done/foundation)
1. Połączenie z API przez QR lub ręczny URL.
2. Logowanie przez `/api/v1/auth/login`.
3. Token w Keychain.
4. Lista ticketów z backendu.

## Etap 2 - USB-C test flow (dla Ciebie na dziś)
1. `./Moj/testy/start-ios-device.sh` uruchamia backend na `0.0.0.0` + CORS LAN.
2. Deploy aplikacji przez Xcode na fizyczny iPhone.
3. Połączenie i testy login + lista zgłoszeń.

## Etap 3 - Core funkcje serwisowe (następny sprint)
1. Utwórz zgłoszenie z iPhone (formularz + walidacja).
2. Dodaj zdjęcia do zgłoszenia.
3. Zmiana statusu kroku serwisowego.
4. Dodawanie komentarzy wewnętrznych/publicznych.

## Etap 4 - UI premium (Apple inspired, bez „przeładowania”)
1. Nawigacja: `NavigationStack` + dolny pasek sekcji.
2. Kartowy dashboard technika (dzisiaj / pilne / moje / oczekujące).
3. Ticket detail jako czytelny ekran etapów (timeline).
4. Animacje kontekstowe: przejścia kart, loading skeleton, szybkie akcje.
5. Tryby motywu: Light, Graphite, Emerald (spójne z desktop/web).

## Etap 5 - Produkcyjna ergonomia
1. Offline queue (lokalne kolejki operacji gdy internet padnie).
2. Retry i diagnostyka API (czytelne komunikaty).
3. Profile filtrów technika (presety „Tylko moje”, „>X dni”, statusy).
4. Powiadomienia i przypomnienia.

## Etap 6 - Jakość i release
1. UI tests (XCUITest): 3 scenariusze live.
2. API contract tests dla iOS payloadów.
3. Test na fizycznym urządzeniu + TestFlight.
4. Dokumentacja onboardingu i checklista deploy.

## 3 scenariusze live (Twoje wymaganie)
1. Nowa instalacja -> iOS connect -> login -> lista ticketów.
2. Dodanie ticketu + zdjęcia -> widoczne od razu w WebUI.
3. Zmiana statusu z iOS -> historia etapów poprawna w desktop/web.

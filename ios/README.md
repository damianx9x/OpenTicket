# OpenTicket iOS (SwiftUI)

Ten katalog zawiera aplikację iOS do pracy technika:
- szybkie połączenie z serwerem (QR lub ręcznie),
- logowanie kontem OpenTicket,
- podgląd i odświeżanie zgłoszeń.

## Co już jest gotowe
1. Szkielet SwiftUI (`ios/SwiftUI/*`).
2. Integracja z backendem OpenTicket (`/api/v1/setup/status`, `/api/v1/auth/login`, `/api/v1/tickets`).
3. Przechowywanie tokenu w Keychain.
4. Obsługa QR (`apiBase`, opcjonalny `token`).

## Szybkie testy na iPhone (USB-C + Xcode)
1. Podłącz iPhone kablem USB-C do Maca.
2. Włącz iPhone i zaakceptuj zaufanie dla tego komputera.
3. Uruchom backend do testów urządzenia:
```bash
cd /Users/icex/Projekty/git_repos/OpenTicket-clean
./Moj/testy/start-ios-device.sh
```
4. Skrypt pokaże adres API dla telefonu, np. `http://192.168.1.20:3200`.
5. W Xcode:
- utwórz projekt iOS App (SwiftUI) lub użyj istniejącego,
- dodaj pliki z `ios/SwiftUI`,
- ustaw Team + Signing,
- wybierz fizyczne urządzenie jako target,
- Run.
6. W aplikacji iOS:
- zeskanuj QR z setupu OpenTicket **albo** wpisz ręcznie adres API,
- zaloguj się kontem admin/technik,
- sprawdź listę ticketów.

## Wymagania sieciowe pod testy urządzenia
1. Backend musi słuchać na `0.0.0.0` (skrypt robi to automatycznie).
2. CORS dla LAN musi być włączony (skrypt też ustawia automatycznie).
3. iPhone i Mac muszą być w tej samej sieci lokalnej (kabel służy do deploy/debug w Xcode).

## Następne kroki (roadmap iOS)
1. Formularz tworzenia zgłoszenia + zdjęcia (`multipart upload`).
2. Skan QR ticketu i przejście do akcji serwisowej.
3. Powiadomienia i przypomnienia technika.
4. Personalizacja widoku technika (filtry, presety).

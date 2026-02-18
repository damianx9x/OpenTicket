# Workflows i integracje — QR, powiadomienia, przyjęcie/odbiór

Dokumentacja przepływów operacyjnych, które warto zaimplementować w systemie, aby obsługa serwisowa była szybka i bezbłędna.

1) Przyjęcie urządzenia (Drop-off)
- Serwisant wybiera "Nowe przyjęcie" lub skanuje numer seryjny.
- Formularz: klient, urządzenie, objawy, akcesoria, zgody.
- System generuje `ticket_number` i `public_token` oraz `qr_token` i zwraca etykietę do wydruku.
- Ticket trafia do listy "Nowe".

2) QR-driven szybkie akcje serwisanta
- Akcje dostępne po zeskanowaniu QR (lista konfigurowalna):
  - Przyjęte do diagnozy
  - Części zamówione
  - Rozpoczęto naprawę
  - Testy zakończone
  - Gotowe do odbioru
  - Wydane klientowi
- Każda akcja: zapis do timeline, opcjonalny formularz (np. opis diagnozy), powiadomienie do klienta i aktualizacja SLA.

3) Powiadomienia i automatyka
- Zdefiniować reguły: on_status_change, on_comment_internal, on_attachment_uploaded.
- Reguły mogą wyzwalać: email, SMS, push, wewnętrzne zadanie (worker) np. "zamów części".

4) Magazyn i części
- Kiedy serwisant wybierze "Zamawiam części" system rezerwuje pozycję w magazynie (integracja z modulem Inventory) lub tworzy zadanie zakupowe.
- Skanowanie QR może jednocześnie przydzielać sprzęt do konkretnego miejsca w magazynie.

5) Odbiór i zamknięcie
- Po wykonaniu naprawy serwisant ustawia status "Gotowe do odbioru"; wysyłane jest powiadomienie do klienta z instrukcjami odbioru i kwotą do zapłaty.
- Przy odbiorze technik skanuje QR i wybiera "Wydane klientowi"; system zamyka ticket i generuje potwierdzenie (PDF/emailed receipt).

API hooks (propozycje)
- `POST /api/v1/tickets/{id}/generate-qr` — generuje QR (png/base64) i token.
- `POST /api/v1/tickets/qr-scan` — body: `{ qr_token, action, technicianId, metadata }` — realizuje zmianę stanu i tworzy timeline entry.
- `POST /api/v1/notifications/send` — wysyła zdefiniowany template (internal use/worker).

Bezpieczeństwo i audyt
- Każde działanie z QR rejestruje `technicianId`, timestamp i IP (jeśli dostępne).
- Wprowadzić kontrolę uprawnień: nie każdy technik może wykonywać wszystkie akcje (np. only senior technician may close ticket).

Przykładowa implementacja QR tokenu
- Payload: `{ ticketId, issuedAt, expiresAt (optional), nonce }` + HMAC signature
- Na backendzie: przy otrzymaniu `qr_token` weryfikować HMAC i ewentualne wygaśnięcie.

Podsumowanie
- Implementacja QR + powiadomień znacząco przyspiesza workflow serwisowy i redukuje błędy operacyjne.
- Proponuję zaczynać od prostego modelu: generuj QR przy przyjęciu i obsługuj 4–5 akcji (diagnoza, części, naprawa, gotowe). Rozszerzać reguły i integracje stopniowo.

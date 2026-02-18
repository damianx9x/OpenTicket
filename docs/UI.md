# UI / UX — opis interfejsów

Poniżej znajdziesz opis proponowanego UI dla trzech głównych interfejsów: aplikacja iOS/macOS (Reporter), portal web (public status) oraz panel administracyjny (admin web).

1) Reporter — iOS / macOS (SwiftUI)
- Ekran główny: lista ostatnich zgłoszeń użytkownika z przyciskiem `+` do utworzenia nowego zgłoszenia.
- Formularz tworzenia zgłoszenia:
  - pola: `title`, `description`, `priority` (picker), `organization` (opcjonalne), przycisk dodaj zdjęcie (Camera / Photo Library), podgląd zdjęć (miniatury).  
  - po wysłaniu: toast potwierdzenia i numeric `ticket_number` / `public_token` jeśli dostępny.
- Szczegóły zgłoszenia: header z numerem, status (kolor), timeline (komentarze i zdarzenia), sekcja zdjęć (pobierane presigned URLs), sekcja kosztów (jeśli dostępna).

UX notes:
- Operacje off‑line: zachować szkic zgłoszenia lokalnie i wysłać w tle (synchronizacja).  
- Push: APNs do powiadomień o zmianie statusu/przypisaniu.

2) Portal publiczny — web (status)
- Minimalny flow: wejście przez `public_token` -> strona z podsumowaniem zgłoszenia.
- Widok:
  - Nagłówek: numer zgłoszenia, status, data utworzenia.
  - Timeline: lista zdarzeń/komentarzy (bez danych internal), przycisk do kontaktu (formularz wysłania komentarza publicznego).
  - Załączniki: miniatury, po kliknięciu pobieranie przez presigned URL (ograniczyć dostęp czasowo).

UX notes:
- Brak konieczności logowania — tylko odczyt i drobne interakcje (public comments) zależnie od konfiguracji.

3) Panel administracyjny — web (Next.js, Admin)
- Główne sekcje: Dashboard, Tickets, Automations, Reports, Settings, Diagnostics.

- Tickets (lista)
  - Filtry: status, priority, assigned agent, organization, date range, full‑text search.
  - Kolumny: number | title | status (badge) | priority | owner | assigned | updated_at | SLA (time left)
  - Bulk actions: assign, change status, export CSV.

- Ticket (szczegóły)
  - Left column: metadane (number/status/priority/channel/owner/assigned/organization/public_token)
  - Center: description + timeline (komentarze public/internal, status changes)
  - Right column: attachments (upload / presign), cost items (add/edit rows with VAT calc), actions (assign, change status, run automations)
  - Comment composer: wysyłka internal/public, możliwość dodania załącznika

- Automations
  - Lista reguł: name | trigger | enabled | last run
  - Edytor reguły: trigger (on status change, on new ticket, cron), conditions (JSON/visual), actions (send email, assign, add comment)

- Reports
  - Proste raporty: liczba ticketów / statusy, SLA breaches, średni czas obsługi

- Settings
  - VAT rates (seeded), users & roles (ADMIN/AGENT/REPORTER/VIEWER), storage settings (MinIO), SMTP, Push credentials (APNs)

- Diagnostics
  - Endpoint health checks (wyświetla ostatnie wyniki `GET /api/v1/diagnostics`), metryki Prometheus, link do logów (jeśli skonfigurowane), przycisk uruchom sanity check.

Design notes
- Kolory statusów: NEW (blue), IN_PROGRESS (teal), WAITING_FOR_CUSTOMER (orange), RESOLVED (green), CLOSED (gray), ARCHIVED (muted).
- Priorytety: URGENT — czerwony badge, HIGH — pomarańczowy, NORMAL — neutralny, LOW — szary.
- Accessibility: stosować semantic HTML/ARIA, kontrast, keyboard navigation, responsywność.

Pliki referencyjne
- Frontend placeholder: `frontend/index.html`
- Admin (proponowany): przenieść do `frontend/admin/` przy rozpoczęciu implementacji Next.js

Formularze serwisowe — wzorce i najczęstsze pola
------------------------------------------------
Poniżej zebrane praktyczne elementy formularzy serwisowych dla sprzętu elektronicznego (telefony, laptopy, tablety, AGD drobne):

- Dane klienta:
  - imię i nazwisko / nazwa firmy
  - telefon kontaktowy (możliwość SMS/email)
  - e‑mail
  - adres (opcjonalnie, do odbioru/dostawy)

- Informacje o urządzeniu:
  - marka, model
  - numer seryjny / IMEI / SN
  - numer fabryczny odczytany lub ręczny
  - rok produkcji / wersja (opcjonalnie)
  - opis dodatkowy (np. kolor)

- Kanał zgłoszenia i dane deklaratywne:
  - źródło: APP / WEB_FORM / EMAIL / DROP_OFF
  - data przyjęcia, przyjęte przez (user/agent)
  - czy urządzenie było wcześniej naprawiane (checkbox)

- Opis usterki i reproducibility:
  - krótki tytuł (pole obowiązkowe)
  - opis problemu (większe pole tekstowe)
  - krok po kroku: jak odtworzyć problem (opcjonalne)

- Załączniki i zdjęcia:
  - możliwość dodania kilku zdjęć (kamera w appie, drag&drop na web)
  - automatyczne tworzenie miniatur i metadanych (EXIF opcjonalnie)

- Akcesoria i dodatkowe elementy:
  - ładowarka, etui, dysk zewnętrzny etc. (lista)

- Uprawnienia i zgody:
  - zgoda na przetwarzanie danych osobowych (RODO), zgoda na naprawę i koszty orientacyjne
  - podpis cyfrowy / ręczny (opcjonalnie)

- Szacunkowe koszty i status płatności:
  - est. koszt wstępny, akceptacja klienta (checkbox)
  - status płatności: unpaid/paid/partially

- Informacje serwisowe (wewnętrzne):
  - przypisany technik, status SLA, notatki techniczne, ID sprzętu w magazynie

- Historia i timeline:
  - automatycznie rejestrowane zdarzenia: przyjęcie, przypisanie, diagnoza, części zamówione, naprawa, testy, wysyłka/odbiór

UX patterns (ułatwiające obsługę)
--------------------------------
- Formularz wielostronicowy (wizard) z zapisywaniem szkicu — dla wygody przy długich opisach.
- Prefill pól z bazy (po wpisaniu SN) — jeśli znane wcześniej rekordy/warantyjne.
- Szablony problemów (np. "nie włącza się", "ekran pęknięty") do szybkiego wyboru.
- Walidacja plików (typ, rozmiar) i asynchroniczny upload (presigned URL).
- CTA po wysłaniu: numer zgłoszenia + public token + przycisk "drukuj naklejkę QR".

Automatyczne powiadomienia i reguły
---------------------------------
- Powiadomienia na e‑mail / SMS: uruchamiane przy kluczowych przejściach statusu (np. przyjęte → diagnoza → części zamówione → gotowe do odbioru).
- Konfigurowalne szablony wiadomości: {ticket_number}, {status}, {estimated_cost}, {pickup_instructions}.
- Możliwość wyboru kanałów na poziomie klienta: preferencje e‑mail / SMS / push.

QR‑driven workflow (pomysł)
---------------------------
Pomysł: generować unikalne kody QR dla każdego przyjętego urządzenia, naklejać na urządzenie i używać do szybkiego operowania stanem urządzenia przez serwisanta.

Przykładowy przebieg:
1. Techniczna obsługa przyjęcia: serwisant tworzy nowe zgłoszenie w aplikacji (lub skanuuje SN), system generuje `ticket_number` i `qr_code` (np. base64/PNG) oraz opcjonalnie drukuje etykietę.
2. Naklejka z QR przyklejana jest na obudowę urządzenia.
3. Przy każdym działaniu serwisowym serwisant skanuje QR aplikacją mobilną i wybiera krok (np. "Biorę do diagnozy", "Zamawiam części", "Rozpoczynam naprawę", "Testy zakończone").
4. Przy zmianie kroku system automatycznie tworzy wpis w timeline i wysyła powiadomienie do klienta (kanał zależny od preferencji).

Korzyści:
- Mniej pomyłek (łatwe przypisanie fizycznego urządzenia do ticketu).
- Szybka aktualizacja statusu bez konieczności wyszukiwania ticketu.
- Możliwość integracji z magazynem (przy skanowaniu "Biorę do naprawy" system rezerwuje części).

Bezpieczeństwo QR:
- Token QR zawiera `ticketId` + krótki HMAC lub checksum, może mieć opcję wygasania (np. do 90 dni).
- Uprawnienia: tylko zautoryzowani technicy mogą wykonać pewne akcje (np. zakończenie naprawy).

Integracja systemowa (co zaimplementować w backendzie)
---------------------------------------------------
- Endpoint do generowania QR: `POST /api/v1/tickets/{id}/generate-qr` (zwraca obraz/URI i token).  
- Endpoint do skanowania/aktualizacji: `POST /api/v1/tickets/qr-scan` z payloadem `{ qr_token, action, technicianId }` lub `PUT /api/v1/tickets/{id}/status` z `source: 'qr'`.
- Hook i powiadomienia: worker/queue, który wysyła e‑mail/SMS/push na podstawie reguły dla danego statusu.

Przykładowe wiadomości powiadomień
----------------------------------
- "Twoje zgłoszenie #12345 przeszło do etapu: Diagnoza. Oczekiwana dalsza informacja w ciągu 48h."
- "Zamówiliśmy części do Twojego urządzenia #12345. Przewidywany czas oczekiwania: 5 dni." 
- Linki do portalu statusu w treści komunikatu z użyciem `public_token`.


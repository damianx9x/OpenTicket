# Research Alignment (NOTATKA_BADANIA_TICKETING_2026-02-20)

Źródło wymagań: `docs/REQUIREMENTS-2026-02-20.md`

Cel tego pliku: przełożyć notatkę badawczą na twarde kryteria wdrożeniowe i testy akceptacyjne.

## 1) Zasady nadrzędne (obowiązujące)
- `Installer-first`: klient ma przejść cały pierwszy start przez aplikację instalatora (desktop), nie przez surowe WebUI.
- `No dead buttons`: każdy element interaktywny w UI musi mieć działające API i efekt biznesowy.
- `Apple-first UX`: czytelność, płynność, brak regresji Safari/WebKit, zgodność z HIG.
- `Determinism`: każda sesja testowa ma odtwarzać stan jak „pierwsze uruchomienie” (`reset/start/smoke`).
- `Security by default`: auth + role + walidacja danych + ograniczenie powierzchni ataku, bez psucia UX.

## 2) Mapowanie notatki na bieżący status

### 2.1 Ticket core + prostota pierwszego kontaktu
- Wymaganie z notatki: szybki i prosty quick submit, minimalny opór wejścia.
- Status: `PARTIAL`
- Co już jest:
  - setup wizard, logowanie admin/technik, dashboard operacyjny,
  - tworzenie ticketu + komentarze + koszty + załączniki.
- Braki:
  - dedykowany tryb „quick submit” 1-2 min ze skróconym formularzem i dynamicznymi polami.

### 2.2 Konsola agenta (kolejki, SLA, handoff)
- Wymaganie z notatki: kolejki, SLA, priorytetyzacja, kontekst klienta, handoff.
- Status: `PARTIAL`
- Co już jest:
  - statusy/priorytety, filtrowanie, widok szczegółów ticketu, notatki.
- Braki:
  - pełny model SLA, metryki FRT/TTR/FCR, bulk actions, routing po umiejętnościach.

### 2.3 Knowledge base + self-service
- Wymaganie z notatki: KB + sugestie artykułów + feedback skuteczności.
- Status: `NOT_STARTED`
- Braki:
  - moduł KB, indeks wyszukiwania, podpowiedzi artykułów przy tworzeniu ticketu.

### 2.4 AI z explainability i handoff
- Wymaganie z notatki: AI ma podawać powód decyzji i umożliwiać override.
- Status: `NOT_STARTED`
- Braki:
  - panel explainability, rejestr decyzji AI, handoff AI->człowiek.

### 2.5 Apple-first i Safari/WebKit
- Wymaganie z notatki: platform conventions, wysoka czytelność, stabilność.
- Status: `PARTIAL`
- Co już jest:
  - testy UI na Chromium + WebKit (`Moj/testy/ui-random-10.sh --all-browsers`),
  - poprawki Safari/WebKit (timeout API, no-store, bezpieczny localStorage).
- Braki:
  - formalne checklisty HIG (44x44 touch target, contrast budget, accessibility audit AA).

### 2.6 Integracje enterprise (Entra/AD/SSO)
- Wymaganie z notatki: OIDC/SAML + mapowanie ról.
- Status: `NOT_STARTED`

### 2.7 Backup/restore i niezawodność
- Wymaganie z notatki: eksport/import testowany cyklicznie.
- Status: `PARTIAL`
- Co już jest:
  - endpointy backup export/import i UI pod backup.
- Braki:
  - automatyczny cykliczny test odtworzeniowy z walidacją integralności.

## 3) Decyzje architektoniczne (obowiązujące teraz)
- Runtime produktu lokalnego (v1): SQLite.
- Web + desktop: Next.js + Electron (stabilność najpierw).
- iOS/macOS natywne: rozwój równoległy po domknięciu ścieżki installer-first.
- Każda nowa funkcja musi przejść bramkę `5/5 go-no-go` przed przejściem do kolejnego etapu.

## 4) Kolejność wdrażania zgodna z notatką

### Etap A (najbliższy) — Installer-first UX + brak martwych akcji
- Scope:
  - pełny flow konfiguracji tylko przez desktop installer app,
  - inwentaryzacja i test wszystkich przycisków dashboard/login/setup.
- DoD:
  - 0 martwych akcji,
  - 10/10 losowych akcji menu PASS na Chromium i WebKit,
  - test ręczny „pierwszy start klienta” PASS.

### Etap B — Quick submit + SLA-lite + metryki operacyjne
- Scope:
  - skrócony formularz zgłoszenia (progressive disclosure),
  - SLA-lite (terminy i alerty), podstawowe metryki FRT/TTR/FCR/reopen.
- DoD:
  - ticket utworzony do 2 min przez nowego użytkownika,
  - dashboard statystyk działa na realnych danych.

### Etap C — KB + self-service
- Scope:
  - moduł artykułów i podpowiedzi przy tworzeniu ticketu.
- DoD:
  - użytkownik dostaje podpowiedź KB przed wysłaniem zgłoszenia,
  - admin widzi feedback skuteczności artykułów.

### Etap D — Enterprise security + SSO/AD
- Scope:
  - OIDC/SAML, mapowanie ról, polityki dostępu.
- DoD:
  - logowanie SSO działa,
  - role są egzekwowane end-to-end.

## 5) Kryteria jakości (blokujące release)
- `P0`: brak crashy i brak utraty danych.
- `P0`: brak martwych przycisków i brak „pustych” operacji.
- `P0`: instalacja i odinstalowanie działa deterministycznie.
- `P1`: Safari/WebKit parity z Chromium dla krytycznych flow.
- `P1`: backup + restore przechodzą test integralności.

## 6) Testy obowiązkowe przed wysyłką do klienta
- `./Moj/testy/start.sh --fresh --no-open`
- `./Moj/testy/smoke.sh --no-fresh`
- `./Moj/testy/auth-smoke.sh --no-fresh`
- `./Moj/testy/ui-random-10.sh --all-browsers`
- `./Moj/build-oficjalna-instalka.sh`
- instalacja lokalna `.pkg` + pierwszy start + setup + dashboard + deinstalacja.

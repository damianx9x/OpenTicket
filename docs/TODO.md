# OpenTicket TODO (po tygodniowym przeglądzie)

## Priorytet P0
1. Uporządkować release pipeline: automatyczne uploady wszystkich assetów (`pkg`, `exe`, `latest-mac.yml`, `latest.yml`, blockmapy).
2. Domknąć test reinstalacji na czystym koncie użytkownika (instalacja -> konfiguracja -> restart -> login -> deinstalacja -> reinstall).
3. Dodać walidację release przed publikacją (`make release-check`) blokującą brakujące pliki updatera.

## Priorytet P1
1. Dokończyć migrację UI z `frontend/strona-test` do głównego `frontend/app` i usunąć martwe ścieżki.
2. Rozwinąć panel filtrów użytkownika (presety + import/export presetów per user).
3. Dodać backup/restore test automatyczny dla dużego zbioru (>=200 ticketów + uploady).

## Priorytet P2
1. Przygotować plan iOS MVP (pairing LAN, create ticket, upload zdjęć, QR scan).
2. Dodać integracyjne testy aktualizacji (stara wersja -> update -> zachowanie danych).
3. Ujednolicić dokumentację build/release w `README.md`, `Moj/README.md`, `DEVELOPMENT.md`.

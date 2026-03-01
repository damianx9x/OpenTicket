# OpenTicket TODO (po tygodniowym przeglądzie)

## Priorytet P0
1. Dodać walidację release przed publikacją (`make release-check`) blokującą brakujące pliki updatera.
2. Rozszerzyć smoke instalacyjny o scenariusz upgrade + rollback backupu.
3. Zredukować pozostałe `high` z `npm audit`:
   - frontend: plan migracji do `next@16`,
   - backend: plan migracji `@nestjs/serve-static` major.

## Priorytet P1
1. Rozwinąć panel filtrów użytkownika (presety + import/export presetów per user).
2. Dodać gotowe preset packs dla ról (admin/serwisant/recepcja).
3. Dodać backup/restore test automatyczny dla dużego zbioru (>=200 ticketów + uploady).

## Priorytet P2
1. Przygotować plan iOS MVP (pairing LAN, create ticket, upload zdjęć, QR scan).
2. Dodać integracyjne testy aktualizacji (stara wersja -> update -> zachowanie danych).
3. Ujednolicić dokumentację build/release w `README.md`, `Moj/README.md`, `DEVELOPMENT.md`.

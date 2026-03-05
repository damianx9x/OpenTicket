# OpenTicket - rozszerzone scenariusze testowe (2026-03-05)

Cel: pokryć sytuacje, które wcześniej łatwo pomijać w standardowym smoke.

## A. Topologia instalacji
1. `server_client` (lokalnie) - pełny setup i codzienna praca.
2. `client_only` -> podłączenie do działającego serwera.
3. `server_only` (API) - pełny workflow bez udziału UI przeglądarkowego.

## B. Scenariusze operacyjne (nowe)
1. Auto-przypisanie technika przy tworzeniu ticketu przez zalogowanego AGENT/ADMIN.
2. Reużycie konta klienta (historia klienta po e-mail/telefonie/imieniu).
3. Wyszukiwarka po: numerze ticketu, tytule, opisie, danych klienta i komentarzach.
4. Filtry funkcjonalne: `hasComments`, `hasAttachments`, `onlyMine`, `minAgeDays`.
5. Workflow etapów + reopen ticketu po zamknięciu.
6. Backup eksportowany po pełnym użyciu systemu (tickety, komentarze, załączniki, przypomnienia).

## C. Scenariusze bezpieczeństwa i uprawnień
1. AGENT nie może wykonywać endpointów adminowych (`/users/:id PATCH`, `/settings/admin`).
2. AGENT może wykonywać endpointy dozwolone (`/users` GET).
3. Setup token remote host: create/claim/revoke (w testach live + regression).

## D. Scenariusze UX/uprawnień systemowych
1. Asystent zgód w setupie jest widoczny i ma checklistę statusów.
2. Brak czytelności JSON-popup usunięty; wynik zgód prezentowany inline.
3. Jedno kliknięcie do Ustawień systemowych (desktop/macOS).

## Mapowanie na skrypty
- `./Moj/testy/full-regression-suite.sh`
- `./Moj/testy/live-3-suite.sh`
- `./Moj/testy/server-only-deep-smoke.sh`
- `./Moj/testy/role-guard-smoke.sh`

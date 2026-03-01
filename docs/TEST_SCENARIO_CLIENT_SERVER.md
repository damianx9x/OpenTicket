# OpenTicket - Scenariusz testowy: klient łączy się do zainstalowanego serwera

Cel: potwierdzić, że instalacja `sam klient` poprawnie łączy się do istniejącego serwera i pracuje na jego danych.

## Zakres
- serwer i klient działają jako dwa niezależne runtime (oddzielne katalogi `config/data`),
- klient loguje się przez lokalny WebUI, ale pobiera dane z serwera,
- walidujemy pełny przepływ UI (login + lista zgłoszeń).

## Komenda (copy/paste)
```bash
cd /Users/icex/Projekty/git_repos/OpenTicket-clean
./Moj/testy/client-connect-installed-server.sh
```

## 5 testów go/no-go
1. Serwer startuje na osobnym porcie i `POST /api/v1/setup/status` zwraca `setupMode=true`.
2. Setup serwera (`/api/v1/setup/init`) kończy się sukcesem.
3. Po zalogowaniu na serwerze można utworzyć zgłoszenie testowe.
4. Instancja klienta (`/api/v1/setup/client-only`) zapisuje profil połączenia do serwera.
5. Login przez UI klienta pokazuje zgłoszenie utworzone na serwerze.

## Kryterium ukończenia
- skrypt kończy się `PASS`.
- brak błędów w `Moj/testy/runtime/client-connect/server/backend.log` i `Moj/testy/runtime/client-connect/client/backend.log`.

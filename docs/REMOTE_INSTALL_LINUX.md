# OpenTicket Remote Install (Linux + Docker)

## Wymagania
- Linux x86_64/arm64
- Docker Engine + `docker compose`
- Otwarty port API (domyślnie `3200`)

## Szybki start (bez domeny)
```bash
cd OpenTicket-clean
./deploy/docker/install.sh --port 3200
```

Po instalacji skrypt zwraca:
- URL API
- jednorazowy token setup (TTL 15 min)

## Szybki start (HTTPS + domena)
```bash
cd OpenTicket-clean
./deploy/docker/install.sh --with-tls --domain helpdesk.twojadomena.pl --port 3200
```

## Konfiguracja z aplikacji klienckiej
1. Otwórz kreator setup na desktopie/web.
2. Wybierz: `Serwer + klient` -> `Serwer na hoście zdalnym`.
3. Podaj `API URL` i `token setup`.
4. Dokończ konfigurację admina/backupu.

## Operacje
```bash
# zdrowie usługi
./deploy/docker/healthcheck.sh 127.0.0.1 3200

# stop i usunięcie kontenerów (zostaw dane)
./deploy/docker/uninstall.sh

# pełne usunięcie z danymi
./deploy/docker/uninstall.sh --purge
```

## Dane
Wolumeny docker:
- `openticket_data`
- `openticket_config`
- `openticket_logs`

## Bezpieczeństwo
- Token setup jest jednorazowy i wygasa.
- Po zakończeniu setupu endpoint setup zostaje zamknięty.

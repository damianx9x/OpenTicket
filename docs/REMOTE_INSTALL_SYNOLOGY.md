# OpenTicket Remote Install (Synology + Container Manager)

## Wymagania
- Synology DSM 7+
- Container Manager
- Folder współdzielony na dane OpenTicket

## Import stack
1. Skopiuj `deploy/docker/compose.sqlite.yml` oraz `deploy/docker/Caddyfile` na NAS.
2. W Container Manager -> Project -> Create, wskaż `compose.sqlite.yml`.
3. Ustaw zmienne środowiskowe:
   - `OPENTICKET_PORT=3200`
   - `OPENTICKET_IMAGE=ghcr.io/damianx9x/openticket:latest`
   - opcjonalnie `OPENTICKET_DOMAIN=<twoja domena>`
4. Uruchom projekt.

## Token setup
Na NAS (SSH):
```bash
curl -fsS -X POST http://127.0.0.1:3200/api/v1/setup/token/create \
  -H 'content-type: application/json' \
  -d '{"ttlMinutes":15,"maxAttempts":5}'
```

Następnie zakończ setup z aplikacji klienckiej przez token.

## Utrzymanie
- Stop/remove: Container Manager albo `docker compose down`.
- Backup: używaj eksportu `.otbackup` z panelu admina OpenTicket.

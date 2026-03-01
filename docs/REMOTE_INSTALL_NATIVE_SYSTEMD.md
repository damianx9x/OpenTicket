# OpenTicket Remote Install (Linux native systemd)

## Wymagania
- Linux z `systemd`
- Node.js 20+
- npm

## Instalacja
```bash
cd OpenTicket-clean
sudo ./deploy/native/install.sh --port 3200
```

Skrypt:
- buduje backend/frontend
- kopiuje artefakty do `/opt/openticket/app`
- tworzy użytkownika `openticket`
- instaluje usługę `openticket.service`
- uruchamia serwer i generuje token setup

## Obsługa usługi
```bash
sudo systemctl status openticket
sudo systemctl restart openticket
sudo journalctl -u openticket -f
```

## Deinstalacja
```bash
# usuń aplikację, zachowaj dane
sudo ./deploy/native/uninstall.sh

# pełny purge (łącznie z danymi)
sudo ./deploy/native/uninstall.sh --purge
```

## Katalogi
- `/opt/openticket/app`
- `/var/lib/openticket/data`
- `/var/lib/openticket/config`
- `/var/log/openticket/backend.log`

#!/usr/bin/env bash
set -euo pipefail

INSTALLED_UNINSTALLER='/Library/Application Support/OpenTicket/uninstall-openticket.sh'
APP_UNINSTALLER='/Applications/Odinstaluj OpenTicket.command'

if [[ -x "$APP_UNINSTALLER" ]]; then
  exec "$APP_UNINSTALLER"
fi

if [[ -x "$INSTALLED_UNINSTALLER" ]]; then
  exec "$INSTALLED_UNINSTALLER"
fi

echo 'Nie znaleziono lokalnego deinstalatora OpenTicket.'
echo 'Zainstaluj OpenTicket przez .pkg lub uruchom skrypt ./Moj/deinstaluj-openticket.sh z repo.'
exit 1

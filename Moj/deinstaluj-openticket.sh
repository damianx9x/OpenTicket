#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_UNINSTALLER="$ROOT_DIR/scripts/uninstall-ticket-system.sh"
INSTALLED_UNINSTALLER="/Library/Application Support/OpenTicket/uninstall-openticket.sh"
LEGACY_UNINSTALLER="/Library/Application Support/TicketSystem/uninstall-ticket-system.sh"

if [[ -x "$INSTALLED_UNINSTALLER" ]]; then
  exec "$INSTALLED_UNINSTALLER" "$@"
fi

if [[ -x "$LEGACY_UNINSTALLER" ]]; then
  exec "$LEGACY_UNINSTALLER" "$@"
fi

if [[ -x "$LOCAL_UNINSTALLER" ]]; then
  exec "$LOCAL_UNINSTALLER" "$@"
fi

echo "Nie znaleziono deinstalatora."
echo "Oczekiwano:"
echo "  $INSTALLED_UNINSTALLER"
echo "  $LEGACY_UNINSTALLER"
echo "  $LOCAL_UNINSTALLER"
exit 1


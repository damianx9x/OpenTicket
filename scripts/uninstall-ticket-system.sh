#!/usr/bin/env bash
set -euo pipefail

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y)
      FORCE=1
      ;;
    --help|-h)
      cat <<'USAGE'
Użycie: uninstall-ticket-system.sh [--yes]
  --yes   pomija pytanie o potwierdzenie
USAGE
      exit 0
      ;;
    *)
      echo "Nieznany argument: $arg"
      exit 2
      ;;
  esac
done

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  exec sudo /bin/bash "$0" "$@"
fi

confirm() {
  if [[ "$FORCE" == "1" ]]; then
    return 0
  fi

  if [[ -t 0 ]]; then
    read -r -p "To usunie OpenTicket wraz z danymi, logami i cache. Kontynuować? (TAK/nie): " reply
    [[ "$reply" == "TAK" ]]
    return
  fi

  echo "Brak interaktywnego terminala. Użyj --yes aby potwierdzić usunięcie." >&2
  return 1
}

remove_if_exists() {
  local target="$1"
  if [[ -e "$target" || -L "$target" ]]; then
    rm -rf "$target"
    echo "[uninstall] usunięto: $target"
  fi
}

console_user="$(stat -f%Su /dev/console 2>/dev/null || true)"
console_uid=""
if [[ -n "$console_user" && "$console_user" != "root" ]]; then
  console_uid="$(id -u "$console_user" 2>/dev/null || true)"
fi

if ! confirm; then
  echo "Przerwano."
  exit 0
fi

echo "[uninstall] Zatrzymywanie procesów..."
pkill -f "OpenTicket.app" 2>/dev/null || true
pkill -f "Ticket System.app" 2>/dev/null || true
pkill -f "backend/dist/main.js" 2>/dev/null || true
pkill -f "ticket-system-backend" 2>/dev/null || true
pkill -f "openticket-backend" 2>/dev/null || true

if [[ -n "$console_uid" ]]; then
  launchctl bootout "gui/${console_uid}/com.openticket.app" 2>/dev/null || true
  launchctl bootout "gui/${console_uid}/com.openticket.backend" 2>/dev/null || true
  launchctl remove "com.openticket.app" 2>/dev/null || true
  launchctl remove "com.openticket.backend" 2>/dev/null || true
  launchctl bootout "gui/${console_uid}/com.ticketsystem.app" 2>/dev/null || true
  launchctl bootout "gui/${console_uid}/com.ticketsystem.backend" 2>/dev/null || true
  launchctl remove "com.ticketsystem.app" 2>/dev/null || true
  launchctl remove "com.ticketsystem.backend" 2>/dev/null || true
fi

sleep 1

echo "[uninstall] Usuwanie aplikacji i narzędzi..."
remove_if_exists "/Applications/OpenTicket.app"
remove_if_exists "/Applications/Odinstaluj OpenTicket.command"
remove_if_exists "/Applications/Uninstall OpenTicket.command"
remove_if_exists "/Applications/Ticket System.app"
remove_if_exists "/Applications/Odinstaluj Ticket System.command"
remove_if_exists "/Applications/Uninstall Ticket System.command"
remove_if_exists "/Library/Application Support/OpenTicket"
remove_if_exists "/Library/Application Support/TicketSystem"

# Czyść dane dla wszystkich lokalnych użytkowników.
while IFS= read -r home_dir; do
  [[ -z "$home_dir" ]] && continue
  [[ ! -d "$home_dir" ]] && continue

  remove_if_exists "$home_dir/Library/Application Support/Ticket System"
  remove_if_exists "$home_dir/Library/Application Support/TicketSystem"
  remove_if_exists "$home_dir/Library/Application Support/OpenTicket"
  remove_if_exists "$home_dir/Library/Application Support/openticket"
  remove_if_exists "$home_dir/Library/Application Support/ticket-system"
  remove_if_exists "$home_dir/Library/Caches/com.openticket.app"
  remove_if_exists "$home_dir/Library/Caches/OpenTicket"
  remove_if_exists "$home_dir/Library/Caches/com.ticketsystem.app"
  remove_if_exists "$home_dir/Library/Caches/Ticket System"
  remove_if_exists "$home_dir/Library/Logs/OpenTicket"
  remove_if_exists "$home_dir/Library/Logs/com.openticket.app"
  remove_if_exists "$home_dir/Library/Logs/Ticket System"
  remove_if_exists "$home_dir/Library/Logs/com.ticketsystem.app"
  remove_if_exists "$home_dir/Library/Saved Application State/com.openticket.app.savedState"
  remove_if_exists "$home_dir/Library/Saved Application State/com.ticketsystem.app.savedState"
  remove_if_exists "$home_dir/Library/Preferences/com.openticket.app.plist"
  remove_if_exists "$home_dir/Library/Preferences/com.ticketsystem.app.plist"
  remove_if_exists "$home_dir/Library/LaunchAgents/com.openticket.app.plist"
  remove_if_exists "$home_dir/Library/LaunchAgents/com.openticket.backend.plist"
  remove_if_exists "$home_dir/Library/LaunchAgents/com.ticketsystem.app.plist"
  remove_if_exists "$home_dir/Library/LaunchAgents/com.ticketsystem.backend.plist"
done < <(find /Users -mindepth 1 -maxdepth 1 -type d ! -name Shared ! -name Guest)

echo "[uninstall] Czyszczenie receipt-ów pakietu..."
while IFS= read -r pkg; do
  [[ -z "$pkg" ]] && continue
  pkgutil --forget "$pkg" >/dev/null 2>&1 || true
  echo "[uninstall] forgotten pkg: $pkg"
done < <(pkgutil --pkgs | grep -Ei '^com\.ticketsystem(\.|$)' || true)
while IFS= read -r pkg; do
  [[ -z "$pkg" ]] && continue
  pkgutil --forget "$pkg" >/dev/null 2>&1 || true
  echo "[uninstall] forgotten pkg: $pkg"
done < <(pkgutil --pkgs | grep -Ei '^com\.openticket(\.|$)' || true)

echo "[uninstall] Gotowe. System usunięty kompletnie."

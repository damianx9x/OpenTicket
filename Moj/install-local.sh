#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_PATH="$ROOT_DIR/Moj/OpenTicket-Installer.pkg"

if [[ ! -f "$PKG_PATH" ]]; then
  echo "Brak pliku instalatora: $PKG_PATH"
  echo "Najpierw uruchom: ./Moj/build-oficjalna-instalka.sh"
  exit 1
fi

echo "[Moj/install] Instalacja pakietu..."
sudo installer -pkg "$PKG_PATH" -target /

echo "[Moj/install] Uruchamianie aplikacji..."
if [[ -d "/Applications/OpenTicket.app" ]]; then
  open -na "/Applications/OpenTicket.app" --args --setup-assistant --permissions-assistant || open "/Applications/OpenTicket.app"
else
  echo "[Moj/install] BŁĄD: nie znaleziono /Applications/OpenTicket.app po instalacji."
  echo "[Moj/install] Otwieram fallback WebUI setup..."
  open "http://127.0.0.1:3200/setup?source=installer"
fi

echo "[Moj/install] Gotowe"
echo "[Moj/install] Deinstalator po instalacji:"
echo "  /Applications/Odinstaluj OpenTicket.command"

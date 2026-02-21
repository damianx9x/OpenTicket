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
open "/Applications/OpenTicket.app"

echo "[Moj/install] Gotowe"
echo "[Moj/install] Deinstalator po instalacji:"
echo "  /Applications/Odinstaluj OpenTicket.command"

#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

PURGE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --purge)
      PURGE=1
      shift
      ;;
    -h|--help)
      echo "Usage: sudo ./deploy/native/uninstall.sh [--purge]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

systemctl disable --now openticket 2>/dev/null || true
rm -f /etc/systemd/system/openticket.service
systemctl daemon-reload

if [[ "$PURGE" -eq 1 ]]; then
  rm -rf /opt/openticket /var/lib/openticket /var/log/openticket /etc/openticket
  userdel openticket 2>/dev/null || true
  echo "OpenTicket removed with data purge."
else
  rm -rf /opt/openticket
  echo "OpenTicket binaries removed; data preserved in /var/lib/openticket."
  echo "Use --purge for complete cleanup."
fi

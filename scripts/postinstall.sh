#!/bin/bash
# postinstall script for macOS installer
set -e

echo "Tworzenie katalogów danych..."
mkdir -p /usr/local/ticket-system/data
mkdir -p /usr/local/ticket-system/storage

# Inicjalizacja bazy (prisma migrate)
cd /usr/local/ticket-system/backend
npm ci
npx prisma migrate deploy
npx ts-node prisma/seed.ts

echo "Generowanie QR admina..."
node scripts/ticketctl.js generate-qr admin > /usr/local/ticket-system/admin-qr.txt

echo "Instalacja zakończona. QR admina zapisany w admin-qr.txt"

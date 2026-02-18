#!/bin/bash

# Upewnij się, że skrypt działa z głównego katalogu projektu
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "🔧 Rozpoczynam naprawę systemu Ticket System..."

# 1. Przebuduj i uruchom kontenery
echo "🐳 Przebudowa frontendu (dodano stronę testową)..."
docker-compose up -d --build frontend

# Czekamy chwilę na wstanie bazy danych
echo "⏳ Oczekiwanie na gotowość bazy danych (5s)..."
sleep 5

# 2. Wymuś aktualizację schematu bazy danych (naprawia brak tabel)
echo "🔄 Tworzenie tabel w bazie danych (db push)..."
docker-compose exec -T backend npx prisma db push --accept-data-loss

# 3. Wypełnij bazę danymi startowymi (naprawia brak stawek VAT i użytkowników)
echo "🌱 Wypełnianie danymi startowymi (seed)..."
docker-compose exec -T backend npx prisma db seed

echo "✅ Naprawa zakończona! Odśwież stronę w przeglądarce."
echo "   Panel Admina: http://localhost"
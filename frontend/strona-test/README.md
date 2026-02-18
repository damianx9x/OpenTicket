# Apple Service Ticketing System - Demo Panel

## Opis

Interaktywne demo panelu administracyjnego systemu obsługi zgłoszeń dla serwisu Apple w Gdańsku. System umożliwia zarządzanie naprawami urządzeń Apple (MacBook, iPhone, iPad, itp.) z kalkulacją kosztów wg stawek VAT obowiązujących w Polsce.

## Funkcjonalności

✅ **Zarządzanie zgłoszeniami** (NEW, IN_PROGRESS, WAITING_FOR_CUSTOMER, CLOSED)  
✅ **Poziomy priorytetu** (LOW, NORMAL, HIGH, URGENT)  
✅ **Komentarze publiczne i notatki wewnętrzne** (widoczne tylko dla agentów)  
✅ **Kosztoplan z VAT** (5%, 8%, 23%, zwolnienie)  
✅ **Filtry i wyszukiwanie**  
✅ **Przypisywanie do agentów**  
✅ **Obsługa urządzeń Apple** (MacBook Pro, MacBook Air, iPhone, iPad, itp.)

## Instalacja i uruchomienie

### Wymagania
- Node.js v18+
- npm v9+

### Kroki

```bash
# Przejdź do folderu strona-test
cd frontend/strona-test

# Zainstaluj zależności (jeśli jeszcze nie zainstalowane)
npm install

# Uruchom serwer deweloperski
npm run dev
```

Aplikacja będzie dostępna na: `http://localhost:3001/`

## Dane demo

System zawiera 5 przykładowych zgłoszeń:
- **#36** - Nie działa internet na 2. piętrze (URGENT, IN_PROGRESS)
- **#35** - Wymiana myszki w foyer (LOW, NEW)
- **#34** - Problem z drukarką MacBook Pro (HIGH, WAITING_FOR_CUSTOMER)
- **#33** - Wymiana baterii MacBook Air (NORMAL, CLOSED)
- **#32** - iPhone 12 - zbita obudowa ekranu (HIGH, IN_PROGRESS)

## Budowa projektu

```
src/
├── components/
│   ├── Sidebar.tsx              # Menu boczne
│   ├── TopHeader.tsx            # Nagłówek górny
│   ├── TicketsOverview.tsx      # Karty statystyk
│   ├── TicketsTable.tsx         # Tabela zgłoszeń
│   └── TicketDetailModal.tsx    # Modal ze szczegółami
├── services/
│   └── dataStore.ts             # Symulacja bazy danych
├── types.ts                     # Typy TypeScript
├── index.css                    # Style globalne (Tailwind)
├── App.tsx                      # Główny komponent
└── main.tsx                     # Entry point
```

## Technologia

- **React 18** - Frontend framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide Icons** - Ikony SVG

## Dane bazy (In-memory)

Dane są przechowywane w pamięci - po odświeżeniu strony powrócą do stanu początkowego. To czysty demo bez backendu.

## Jak to wygląda?

### Główna lista zgłoszeń
- Widok tabelaryczny z ID, tematem, klientem, statusem, priorytetem
- Live search po tytule, ID lub kliencie
- Filtry ze statusem i priorytetem
- Klikając na wiersz - otwiera się panel szczegółów

### Panel szczegółów (Side Panel)
- Pełne dane zgłoszenia i klienta
- Historia komentarzy (publicznych i wewnętrznych)
- Dodawanie nowych komentarzy
- Tabela pozycji kosztów z obliczeniami VAT
- Zarządzanie status, priorytet, przypisanie agenta

### Karty statystyk
- Liczba otwartych zgłoszeń (NEW)
- Liczba pilnych (URGENT)
- Liczba w trakcie (IN_PROGRESS)
- Liczba zamkniętych dzisiaj

## Wdrażanie w produkcji

To demo jest w całości frontendowe. Do wdrożenia w produkcji potrzebujesz:

1. **Backend API** (NestJS, Vapor, itp.)
2. **Baza danych** (PostgreSQL)
3. **Autentykacja** (JWT, OAuth2)
4. **Storage** na dokumenty (MinIO, S3)
5. **Powiadomienia** (email, push)

## Kontakt i obsługa

System rozwijany dla serwisu Apple **mekintosz.pl** w Gdańsku.

---

**Wersja:** 1.0.0  
**Data:** Luty 2026

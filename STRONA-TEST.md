# Strona-Test - Demo System Ticketowego

## Opis

To jest **interaktywna strona demo** panelu administracyjnego systemu obsługi zgłoszeń dla serwisu Apple. Całkowicie niezależna aplikacja React + Vite, bez potrzeby backendu - idealna do prezentacji klientom.

## 📍 Lokalizacja

```
frontend/strona-test/
├── README.md
├── package.json
├── vite.config.ts
├── src/
│   ├── App.tsx
│   ├── types.ts
│   ├── index.css
│   ├── main.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── TopHeader.tsx
│   │   ├── TicketsOverview.tsx
│   │   ├── TicketsTable.tsx
│   │   └── TicketDetailModal.tsx
│   └── services/
│       └── dataStore.ts (In-memory data simulation)
└── index.html
```

## 🚀 Szybki start

```bash
# Przejdź do folderu
cd frontend/strona-test

# Zainstaluj zależności
npm install

# Uruchom serwer (otworzy się na http://localhost:3001)
npm run dev

# Build produkcyjny
npm run build

# Preview build
npm run preview
```

## ✨ Funkcje

| Funkcja | Status | Opis |
|---------|--------|------|
| Lista zgłoszeń | ✅ | Tabela z filtrowaniem i wyszukiwaniem |
| Szczegóły zgłoszenia | ✅ | Side panel z pełnymi informacjami |
| Komentarze | ✅ | Publiczne i notatki wewnętrzne |
| Kalkulator VAT | ✅ | Pozycje kosztów z różnymi stawkami VAT |
| Zarządzanie statusem | ✅ | NEW, IN_PROGRESS, WAITING_FOR_CUSTOMER, CLOSED |
| Priorytety | ✅ | LOW, NORMAL, HIGH, URGENT |
| Przypisywanie agentów | ✅ | Możliwość przypisania do zespołu |
| Statystyki | ⏳ | Wkrótce |
| Raportowanie | ⏳ | Wkrótce |

## 📊 Dane Demo

System zawiera 5 gotowych zgłoszeń pokazujących różne scenariusze:

1. **#36** - Sprawą pilna w trakcie (URGENT, IN_PROGRESS)
2. **#35** - Prosta wymiana sprzętu (LOW, NEW)
3. **#34** - Czeka na odpowiedź klienta (HIGH, WAITING_FOR_CUSTOMER)
4. **#33** - Już zamknięta sprawa (NORMAL, CLOSED)
5. **#32** - Wymiana części elektroniki (HIGH, IN_PROGRESS)

## 🎯 Zastosowanie

Idealna do:
- ✅ Prezentacji klientowi
- ✅ Testowania UX/UI
- ✅ Dokumentacji wymagań
- ✅ Prototypowania
- ✅ Proof of Concept (PoC)

**Nie dla:**
- ❌ Produkcyjnego użytku (brak backendu!)
- ❌ Trwałego przechowywania danych
- ❌ Wielu jednoczesnych użytkowników

## 🔧 Technologia

```json
{
  "framework": "React 18",
  "language": "TypeScript",
  "bundler": "Vite",
  "styling": "Tailwind CSS",
  "icons": "Lucide React",
  "data": "In-memory (demo)"
}
```

## 📝 Uwagi

- **Dane są w pamięci** - po odświeżeniu strony powracają do stanu początkowego
- **Brak API** - wszystko jest symulowaniem w przeglądarce
- **Responsive design** - działa na desktopie, tablecie i telefonie
- **Dark mode ready** - możemy dodać jeśli potrzebny

## 🎓 Jak to działa wewnętrznie

1. **dataStore.ts** - Symulowa baza danych w memory
2. **Komponenty React** - Renderują interfejs
3. **useState/useCallback** - Zarządzanie stanem
4. **Tailwind CSS** - Styling w utility-first

Brak żadnych żądań HTTP - wszystko lokalnie w przeglądarce!

## 🔗 Powiązane

- Główny projekt: `../` (README.md)
- Backend API: `../../backend/` (wkrótce)
- iOS app: `../../ios/` (SwiftUI)

## 👥 Dla kogo?

**Serwis Apple "Mekintosz"** w Gdańsku - system przyjmowania i obsługi zgłoszeń serwisowych.

---

**Autor:** GitHub Copilot  
**Wersja:** 1.0.0  
**Data:** Luty 2026  
**Status:** ✅ Production Demo


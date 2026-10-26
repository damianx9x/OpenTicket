# Rozwój OpenTicket

[← Opis projektu](README.md) · [Współpraca](CONTRIBUTING.md) · [Budowanie](BUILD.md)

## Środowisko

Kod aplikacji używa Node.js/npm. Skrypty operacyjne wymagają Bash, GNU Make, curl i lsof; na Windows użyj środowiska zgodnego z tymi wymaganiami. Dobierz wspieraną wersję Node.js zgodną z zależnościami. Instrukcja opisuje istniejące polecenia, nie wynik świeżego testu instalacji na każdym systemie.

## Pobranie i zależności

```bash
git clone --branch develop https://github.com/damianx9x/OpenTicket.git
cd OpenTicket
npm --prefix backend install
npm --prefix frontend install
npm --prefix desktop install
npm --prefix backend run prisma:generate
```

Przed startem przejrzyj [.env.example](.env.example) i konfigurację właściwego modułu. Własne dane dostępowe przechowuj lokalnie poza Git. Nie używaj danych produkcyjnych w środowisku deweloperskim.

## Lokalny start

```bash
make up
```

Skrypt uruchamia backend i frontend oraz wypisuje adresy. Porty początkowe to 3000 i 3001; przy zajętym porcie skrypt szuka kolejnego. Dane, konfiguracja i logi lokalnego uruchomienia trafiają do `.runtime/`. Ten tryb ustawia `APP_ENV=DEV_LOCAL` i flagę pozwalającą na reset deweloperski — nie używaj go jako konfiguracji produkcyjnej.

| Polecenie | Efekt |
| :--- | :--- |
| `make diagnose` | Diagnostyka i paczka raportów |
| `make test` | Build backendu, frontendu i części Electron |
| `make smoke` | Kontrola działającego środowiska |
| `make desktop-dev` | Uruchomienie modułu Electron w trybie dev |
| `make down` | Zatrzymanie lokalnych procesów zarządzanych przez skrypt |

`make test` nie uruchamia pełnego zestawu testów runtime. Scenariusze są także w [Moj/testy/](Moj/testy/) i [scripts/ci/](scripts/ci/). Przed ich uruchomieniem sprawdź zależności scenariusza i środowisko docelowe; część zakłada uruchomioną aplikację lub określoną platformę. Nie uruchamiaj resetów, migracji ani publikacji na produkcji w ramach zwykłego smoke testu.

## Struktura i zmiany

Backend, frontend i desktop mają osobne `package.json`. Dodawaj polecenia na podstawie skryptów danego modułu — nie zakładaj istnienia `npm test`, `npm run lint` lub `npm run package` wszędzie.

Twórz małe branche z `develop`, wykonaj sprawdzenia odpowiednie dla zmiany i opisz ich rzeczywisty wynik w PR. Zgłoszenie powinno rozróżniać błąd, oczekiwane zachowanie i zaobserwowany rezultat.

[Instalacja hosta zdalnego](docs/REMOTE_INSTALL_QUICKSTART_PL.md) · [Historia zmian](CHANGELOG.md)

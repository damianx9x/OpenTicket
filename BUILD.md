# Budowanie OpenTicket

[← Opis projektu](README.md) · [Przygotowanie środowiska](DEVELOPMENT.md)

## Gotowe wydania

Instalatory i sumy kontrolne znajdują się w [GitHub Releases](https://github.com/damianx9x/OpenTicket/releases). Wersja kodu na `develop` może być nowsza od opublikowanych instalatorów.

## Kompilacja modułów

Po instalacji zależności opisanej w DEVELOPMENT.md:

```bash
make test
```

Ten target buduje backend, frontend oraz kod Electron. Nie tworzy wszystkich instalatorów i nie zastępuje testów działania aplikacji.

## Pakowanie desktopu

Polecenia z istniejącego `desktop/package.json`:

```bash
npm --prefix desktop run dist:mac
npm --prefix desktop run dist:win
```

Pakowanie zależy od systemu, narzędzi i konfiguracji podpisywania. Samo istnienie targetu nie oznacza, że cross-build przejdzie na dowolnym hoście. Wyniki electron-builder trafiają do `desktop/release/` według bieżącej konfiguracji.

## Dedykowane skrypty instalatorów

Repozytorium zawiera też targety `make installer-official` i `make installer-official-win`, korzystające z katalogu [Moj/](Moj/). Przed użyciem sprawdź skrypt oraz jego zależności. Szczegóły desktopu: [DESKTOP-BUILD.md](DESKTOP-BUILD.md).

## Publikacja

Budowanie i publikowanie to osobne operacje. Publikację przeprowadzaj z kontrolowanego środowiska, po sprawdzeniu wersji, artefaktów, podpisów/sum kontrolnych i wyników testów. Nie wpisuj tokenów ani certyfikatów do repozytorium.

## iOS i host zdalny

Moduł iOS ma osobną ścieżkę rozwoju: [plan iOS](docs/IOS_DEVELOPMENT_PLAN.md). Instalacja hosta: [remote quickstart](docs/REMOTE_INSTALL_QUICKSTART_PL.md). Nie utożsamiaj spakowanego desktopu z wdrożeniem serwera lub wydaniem iOS.

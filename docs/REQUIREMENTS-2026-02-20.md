# Wymagania Produktowe (2026-02-20)

Ten dokument porządkuje wymagania użytkownika, które były wcześniej zebrane w notatce badawczej poza repo.
Służy jako trwałe źródło wymagań dla roadmapy i kryteriów akceptacji.

## Priorytety P0
- Stabilna komunikacja backend ↔ frontend.
- Deterministyczny cykl `start / stop / reset / diagnose`.
- Instalator macOS „all-in-one” (bez dociągania przy instalacji i pierwszym uruchomieniu).
- Brak martwych przycisków w UI.
- Narzędzia serwisowe w aplikacji (restart silnika, logi, diagnostyka, reset do setupu).

## Priorytety P1
- UI zgodne z referencyjnym demo (spójność wizualna + animacje).
- Rola `ADMIN` zarządza użytkownikami, rolami, konfiguracją firmy i integracjami.
- Rejestracja technika tylko po zalogowaniu (admin-managed workflow).
- Wyszukiwanie zgłoszeń po numerze/temacie/opisie/danych klienta.
- Załączniki zdjęć i plików do zgłoszeń.
- Backup/restore (baza + pliki) z jednego pliku.

## Priorytety P2
- Tryb `server_client` i `client_only` w setup wizardzie.
- Auto-odkrywanie serwera w LAN + ręczny adres jako fallback.
- QR i kod paskowy dla workflow serwisowego + druk etykiet.
- Rozbudowane statystyki i personalizacja widoku technika.
- I18N: pełne PL/EN.

## Kryteria jakości
- Każdy etap ma 5 testów go/no-go i przejście dopiero po 5/5.
- Testy przeglądarkowe muszą obejmować Chromium i WebKit.
- Po każdej zmianie release README musi mieć:
  - postęp,
  - sposób testowania,
  - znane problemy,
  - następne kroki.

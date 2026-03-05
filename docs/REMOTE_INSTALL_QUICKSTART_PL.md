# OpenTicket: instalacja na serwerze zdalnym (wersja dla początkujących)

Ten poradnik jest skrócony i prowadzi krok po kroku. Celem jest uruchomienie serwera OpenTicket na hoście (Linux/Synology), a klienta na komputerze operatora.

## Kiedy wybrać serwer zdalny
- Masz kilka stanowisk i chcesz jedną wspólną bazę.
- Chcesz, aby dane były poza komputerem operatora.
- Chcesz logować się z wielu klientów do jednego serwera.

## Najprostsza opcja (rekomendowana): Docker na Linux

1. Zaloguj się na serwer Linux (SSH).
2. Sklonuj repo i uruchom instalator:
```bash
git clone https://github.com/damianx9x/OpenTicket.git
cd OpenTicket
./deploy/docker/install.sh --port 3200
```
3. Po instalacji skrypt wypisze:
- `API URL`
- jednorazowy `setup token` (ważny czasowo)

## Konfiguracja klienta (desktop)

1. Otwórz OpenTicket na komputerze operatora.
2. W kreatorze wybierz:
- `Serwer + klient`
- `Serwer na hoście zdalnym`
3. Wpisz `API URL` serwera.
4. Wpisz jednorazowy `setup token`.
5. Dokończ konfigurację admina i backupu.

## Ważne zasady bezpieczeństwa
- Token setup jest jednorazowy i wygasa.
- Po zakończeniu setupu endpoint setup jest zamykany.
- Zawsze włącz backup automatyczny i zapisz klucz szyfrowania backupu.

## Diagnostyka (gdy nie łączy)
1. Na serwerze sprawdź health:
```bash
curl -fsS http://127.0.0.1:3200/api/v1/health
```
2. Sprawdź firewall (port 3200 musi być dostępny z LAN/VPN).
3. W OpenTicket uruchom w zakładce `Server`:
- `Raport diagnostyczny`
- `Szybka naprawa`

## Synology i native systemd
- Synology: `/docs/REMOTE_INSTALL_SYNOLOGY.md`
- Linux native systemd: `/docs/REMOTE_INSTALL_NATIVE_SYSTEMD.md`
- Linux Docker (pełna wersja): `/docs/REMOTE_INSTALL_LINUX.md`

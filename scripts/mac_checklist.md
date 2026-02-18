# Ticket System — MacOS Setup Checklist

1. Zainstaluj Homebrew (jeśli nie masz):
   https://brew.sh/
2. Zainstaluj Node.js, Docker, Git:
   brew install node git docker
3. Sklonuj repo:
   git clone <repo-url>
4. Uruchom ticketctl:
   cd projekt-systemu-ticketowego/scripts
   chmod +x ticketctl.js
   ./ticketctl.js install
5. Sprawdź wygenerowany QR admina w admin-qr.txt
6. Uruchom backend:
   cd ../backend
   npm run dev
7. Sprawdź endpointy diagnostyczne:
   curl http://localhost:3000/api/v1/diagnostics
8. Parowanie telefonu:
   Otwórz aplikację iOS, zeskanuj QR admina, wywołaj provisioning endpoint.
9. Sprawdź dostępność serwera przez mDNS/Bonjour (tickets.local)
10. Testuj workflow QR, dodawanie pracowników, upload zdjęć.

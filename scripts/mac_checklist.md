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
   TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@local.test","password":"DevLocal123!"}' | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const x=JSON.parse(s);process.stdout.write((x.data&&x.data.token)||x.token||\"\")})')
   curl http://localhost:3000/api/v1/diagnostics -H "Authorization: Bearer $TOKEN"
8. Parowanie telefonu:
   Otwórz aplikację iOS, zeskanuj QR admina, wywołaj provisioning endpoint.
9. Sprawdź dostępność serwera przez mDNS/Bonjour (tickets.local)
10. Testuj workflow QR, dodawanie pracowników, upload zdjęć.

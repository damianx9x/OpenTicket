# OpenTicket - Security & Improvement Agent Report (2026-02-27)

## Zakres
Raport wykonany w 3 strumieniach ("agenci"):  
1. Agent `SECURITY-CHECK` - audyt bezpieczeństwa wg aktualnych standardów.  
2. Agent `SYSTEM-IMPROVEMENTS` - wyszukanie brakujących funkcji możliwych do szybkiego wdrożenia.  
3. Agent `IMPLEMENTATION-INTERPRETER` - interpretacja wyników i wdrożenie zmian niskiego ryzyka.

## Agent 1 - SECURITY-CHECK
### Źródła standardów (aktualne)
- OWASP ASVS v5: https://owasp.org/www-project-application-security-verification-standard/  
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html  
- OWASP SSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html  
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html  
- Electron Security Tutorial: https://www.electronjs.org/docs/latest/tutorial/security  
- Next.js security notices: https://nextjs.org/blog  

### Wnioski audytu
- Krytyczne podatności w zależnościach: **0** (po aktualizacji).  
- Pozostałe high:
  - `backend`: 2 (transytywne, wymagają dużej aktualizacji `@nestjs/serve-static` major),
  - `frontend`: 1 (Next.js, fix wymagający major upgrade do v16).  
- E2E + smoke po hardeningu: **PASS**.

### Wdrożone poprawki bezpieczeństwa
1. CORS zaostrzony:
   - prywatne originy LAN tylko przy `CORS_ALLOW_PRIVATE_LAN=1` lub `APP_ENV=DEV_LOCAL`,
   - `credentials: false` (token bearer, brak cookie-sesji).
2. Swagger ograniczony:
   - domyślnie OFF poza `DEV_LOCAL` (lub `SWAGGER_ENABLED=1`).
3. Setup hardening:
   - `POST /api/v1/setup/init` oraz `POST /api/v1/setup/dev-reset` tylko z loopback.
4. Auth hardening:
   - throttling per `email+ip` (10 błędnych logowań / 15 min -> 429 lock 15 min),
   - domyślna sesja skrócona do 14 dni (`AUTH_SESSION_DAYS`, clamp 1..90),
   - automatyczny rehash haseł po poprawnym logowaniu (podniesiony koszt PBKDF2).
5. Integracje webhook:
   - walidacja URL (protokół, host, blokada loopback/private wg flag),
   - blokada HTTP domyślnie poza DEV (`TICKET_SYSTEM_ALLOW_INSECURE_WEBHOOKS`).
6. Frontend XSS hardening:
   - usunięte `dangerouslySetInnerHTML` z QR (render jako `img data URL`).
7. Electron hardening:
   - blokada nieautoryzowanej nawigacji (`will-navigate`),
   - blokada popupów (`setWindowOpenHandler`),
   - ograniczenie uprawnień renderer do origin aplikacji.

### Nowy automatyczny check
- `scripts/security-check.sh`  
  - audyt zależności (`backend/frontend/desktop`),
  - build verification,
  - skan ryzykownych wzorców kodu,
  - raport JSON do `.runtime/reports/`.

---

## Agent 2 - SYSTEM-IMPROVEMENTS
### Co jeszcze warto wdrożyć (niskie ryzyko / duża wartość)
1. 2FA dla ADMIN (TOTP) + wymuszenie dla kont uprzywilejowanych.
2. Wersjonowanie i rotacja sesji (krótkie access + refresh flow dla WebUI).
3. WAF-light dla endpointów integracyjnych (`notifications`, `backup/import`) z dodatkowymi limitami.
4. Signed support bundle (hash + opcjonalny podpis) przed wysyłką do supportu.
5. Skan backupu przy imporcie (integrity + schema compatibility check).
6. Security dashboard dla admina (ostatnie logowania, blokady 429, status hardeningu).

### Funkcje produktowe łatwe na istniejącej infrastrukturze
1. SLA timers per status (kolor + alert przy przekroczeniu).
2. Saved views: presety filtrów per rola (shared/team/private).
3. Canned responses dla komentarzy i wiadomości do klienta.
4. Audit timeline per ticket (kto/co/kiedy).
5. Bulk actions (zmiana statusu/przypisania na wielu zgłoszeniach).

---

## Agent 3 - IMPLEMENTATION-INTERPRETER
### Co wdrożono teraz
- wszystkie poprawki z sekcji Agent 1,
- automatyczny skrypt security-check,
- aktualizacja krytycznych zależności frontend/backend tam, gdzie nie wymagało to przebudowy architektury.

### Co zostaje na kolejny sprint
1. Plan migracji `next@16` (usunięcie ostatniego high z frontendu).
2. Plan migracji `@nestjs/serve-static` major (usunięcie 2x high z backendu).
3. 2FA admin + security dashboard.

### Status release
- Security gate: **GO** (brak critical, testy PASS, hardening aktywny).
- Zalecenie: publikować jako patch release i kontynuować redukcję `high` w następnym sprincie.

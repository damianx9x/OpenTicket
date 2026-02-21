# Architektura — szkic v1

Krótki wyciąg najważniejszych zaleceń z oryginalnego README (source: `redme.md.txt`):

- Reverse proxy: Caddy (TLS)
- Backend API: /api/v1 (kontrakt OpenAPI)
- DB: PostgreSQL
- Kolejka: Redis + worker
- Storage zdjęć: MinIO (S3‑compatible)
- Push: APNs (iOS/macOS) + Web Push dla przeglądarek

W tym szkielecie utworzyłem:

- szkic backendu w TypeScript (NestJS-like) w `backend/` z konfiguracją Swagger (OpenAPI) dostępną pod `/api/docs` po uruchomieniu,
- zachowałem oryginalny Express stub w `backend/legacy/express-index.js` dla odniesienia,
- dodałem podstawowy CI w `.github/workflows/ci.yml`,
- dodałem szkic aplikacji SwiftUI w `ios/SwiftUI`.

Następne kroki:
- Zainstalować zależności w `backend/` (npm ci) i uruchomić `npm run dev` lub `npm run build && npm start`.
- Dodać szczegółową specyfikację OpenAPI (jeśli chcesz, mogę wygenerować szkielet OpenAPI z endpointami opisanymi w `redme.md.txt`).
- Opcjonalnie: zrefaktoryzować frontend do Next.js i połączyć z backendem.

Diagnostics
-----------
- `GET /api/v1/diagnostics` — szybkie sprawdzenia zdrowia usług (wymaga tokenu `ADMIN`).
- `GET /api/v1/diagnostics/metrics` — Prometheus metrics (wymaga tokenu `ADMIN`).
- Request logging via `morgan` w trybie `combined` (łatwe przeglądanie żądań i odpowiedzi podczas debugowania).

Wdrożenie: endpointy diagnostyczne są dostępne po zalogowaniu kontem `ADMIN`.

W tym szkielecie utworzono minimalny backend (Express) i prosty statyczny frontend.

Następne kroki:
- Zainicjować repo Git
- Zainstalować zależności w `backend/` (npm install)
- Rozważyć generowanie OpenAPI oraz klienta iOS

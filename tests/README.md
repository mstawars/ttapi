
**Struktura repozytorium testów**

tests/
├── package.json              # @playwright/test + allure-playwright + typescript + @types/node
├── tsconfig.json
├── playwright.config.ts      # 2 projekty: api (bez przeglądarki) + e2e (Chromium)
├── .gitignore
├── helpers/
│   └── auth.ts               # Token provider – ROPC flow z Keycloak, cache w pamięci
├── api/
│   ├── create-ticket.spec.ts # TC-001, TC-010 (idempotencja), TC-006 (401)
│   ├── close-ticket.spec.ts  # TC-020..TC-026 – zamknięcie z 5 różnych statusów
│   └── add-note.spec.ts      # TC-031..TC-035 – notatka przy prawidłowych i błędnych statusach
└── e2e/
    └── ticket-journey.spec.ts  # Pełna ścieżka: login → create → inProgress → note → close

**Uruchomienie**

cd tests
npm install
# uruchom oba projekty (api najpierw, potem e2e)
npm test

# tylko API
npm run test:api

# tylko E2E
npm run test:e2e

# raport Allure (wymaga: npm install -g allure-commandline)
npm run report

**Kluczowe decyzje projektowe**

| Kwestia | Rozwiązanie |
|--------|-------------|
| Status inProgress w E2E | Brak publicznego endpointu do ustawiania inProgress – test nawiguje do pre-seeded ticketu TT-2026-0007 (alpha, seed SQL) |
| Izolacja danych API | Testy tworzące acknowledged/rejected generują unikalny externalId (UUID) – bezpieczne dla wielokrotnych uruchomień |
| Pre-seeded tickets | TT-2026-0007 (inProgress, api/add-note), TT-2026-0016 (inProgress, api/close-ticket), TT-2026-0019 (resolved) |
| Kolejność projektów | api → e2e; projekt api dodaje notatkę do TT-2026-0007 bez zamykania, e2e zamyka go na końcu |
| ⚠️ Powtórne uruchomienie | Testy używające pre-seeded inProgress/resolved ticketów wymagają przywrócenia seed data: `docker compose down -v && docker compose up -d` |
# TTAPI tests (Playwright)

Zestaw testow automatycznych dla Trouble Ticket:
- API black-box (REST)
- E2E UI (przegladarka)

Testy uruchamiane sa przez Playwright w 2 projektach:
- `api` - request context (bez przegladarki)
- `e2e` - Desktop Chrome

## Struktura

```
tests/
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── global-setup.ts
├── .env
├── .gitignore
├── helpers/
│   ├── auth.ts
│   ├── dbConnection.ts
│   ├── fixtures.ts
│   ├── test-env.ts
│   └── ticket-api.ts
├── api/
│   ├── create-ticket.spec.ts
│   ├── close-ticket.spec.ts
│   ├── add-note.spec.ts
│   └── get-ticket.spec.ts
└── e2e/
        ├── create-add-note-close-ticket.spec.ts
        └── pages/
```

## Co testujemy (API)

- `create-ticket.spec.ts`
    - tworzenie ticketu (201)
    - idempotencja `(tenantId, externalId)` (200 przy duplikacie)
    - walidacja `serviceId`
    - walidacja statusu przy create (`VALIDATION_ERROR`)
    - brak tokenu (401)

- `close-ticket.spec.ts`
    - poprawne zamkniecie z `acknowledged` i `inProgress`
    - niedozwolone przejscia statusow (`STATUS_TRANSITION_ERROR`)
    - walidacja statusu innego niz `closed` w PATCH (`VALIDATION_ERROR`)

- `add-note.spec.ts`
    - notatki dla statusow dozwolonych
    - blokada notatek dla `resolved`, `closed`, `rejected` (`NOTE_ADDITION_NOT_ALLOWED`)

- `get-ticket.spec.ts`
    - GET szczegolow wlasnego ticketu (200)
    - GET szczegolow cudzego ticketu (404, `TROUBLE_TICKET_NOT_FOUND`)
    - GET listy zawiera tylko zasoby bieżącego tenanta

## Co testujemy (E2E)

`create-add-note-close-ticket.spec.ts`:
- scenariusz tworzenia i zamkniecia ticketu
- scenariusz dodania notatki do `inProgress` (fixture)
- scenariusz braku mozliwosci dodania notatki do `closed`

Logowanie E2E jest realizowane w `beforeEach` i uzywa danych tenantow z `.env`.

## Konfiguracja srodowiska

Testy czytaja konfiguracje z `.env` (przez `helpers/test-env.ts`).

Najwazniejsze zmienne:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`
- `KC_BASE_URL`, `KC_REALM`, `KC_CLIENT_ID`, `KC_DEFAULT_PASSWORD`
- `TENANT_ALPHA_USERNAME`, `TENANT_ALPHA_PASSWORD`
- `TENANT_BETA_USERNAME`, `TENANT_BETA_PASSWORD`
- `TENANT_GAMMA_USERNAME`, `TENANT_GAMMA_PASSWORD`
- `FRONTEND_URL`, `API_BASE_URL`

## Seed danych testowych

`global-setup.ts` seeduje dedykowane tickety `FIXTURE-*` bezposrednio do PostgreSQL.
Wykorzystywane sa m.in. w testach `close`, `add-note` i E2E.

## Uruchamianie

Zakladamy uruchomione srodowisko aplikacji (docker compose z backendem, keycloak, db, frontendem).

```bash
cd tests
npm ci

# wszystkie testy (api, potem e2e)
npm test

# tylko API
npm run test:api

# tylko E2E (UI mode)
npm run test:e2e
```

## Raport Allure

```bash
cd tests
npm run report:generate
npm run report:open
```

## Uwagi

- Czesci testow API sa celowo "bug-detection" i moga failowac, jesli backend nie spelnia zalozen z TASK.md.
- Testy uzywaja unikalnych `externalId` (UUID), aby ograniczyc kolizje danych.
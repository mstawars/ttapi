# TTAPI tests (Playwright)

Zestaw testow automatycznych dla Trouble Ticket:
- API black-box (REST)
- E2E UI (przegladarka)

Testy uruchamiane sa przez Playwright w 2 projektach:
- `api` 
- `e2e` 

## Struktura

```
tests/
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── eslint.config.cjs
├── global-setup.ts
├── .env
├── .gitignore
├── helpers/
│   ├── api-response.ts
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
        ├── CreateTicketPage.ts
        ├── LoginPage.ts
        ├── TicketDetailPage.ts
        └── TicketListPage.ts
```

## Zakres testów (API)

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

## Zakres testów (E2E)

`create-add-note-close-ticket.spec.ts`:
- scenariusz tworzenia i zamkniecia ticketu
- scenariusz dodania notatki do `inProgress` (fixture)
- scenariusz braku mozliwosci dodania notatki do `closed`

Logowanie E2E jest realizowane w `beforeEach` i uzywa danych tenantow z `.env`.

## Konfiguracja środowiska

Testy czytaja konfiguracje z `helpers/test-env.ts` bez fallbackow.
Wartosci musza byc dostarczone przez plik `.env` (lokalnie) albo zmienne CI/CD (np. GitLab Variables).

Ladowanie plikow lokalnych:
- domyslnie: `.env`
- przy ustawionym `APP_ENV`: najpierw `.env.<APP_ENV>`, potem `.env` jako uzupelnienie
- zmienne przekazane przez system/CI maja priorytet i nie sa nadpisywane przez dotenv

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

## Aplikacja testowana (repozytorium prywatne)

Kod testow znajduje sie w tym repozytorium, natomiast sama aplikacja (backend + frontend + docker compose)
jest uruchamiana z oddzielnego, prywatnego repozytorium: `mstawars/ttapi_app`.

W CI/CD workflow pobiera oba repozytoria:
- to repozytorium z testami,
- prywatne repozytorium aplikacji,

a nastepnie uruchamia srodowisko aplikacji przez Docker Compose i odpala testy Playwright.

## Uruchamianie

Zakladamy uruchomione srodowisko aplikacji (docker compose z backendem, keycloak, db, frontendem).

```bash
cd tests
# utworz plik .env i uzupelnij wymagane zmienne lub dodaj plik przeslany wraz z linkiem do tego repozytorium
touch .env
npm ci
npx playwright install --with-deps chromium

# wszystkie testy (api, potem e2e)
npm test

# tylko API
npm run test:api

# tylko E2E
npm run test:e2e
```

Plik `.env` jest wymagany przy uruchamianiu lokalnym. Powinien zawierac wszystkie zmienne opisane
w sekcji „Konfiguracja srodowiska”.

## CI/CD i publikacja raportu

Testy moga byc uruchamiane automatycznie w GitHub Actions (push / pull request / workflow_dispatch).
Pipeline:
- checkoutuje testy z tego repozytorium,
- checkoutuje aplikacje z prywatnego repozytorium `mstawars/ttapi_app`,
- uruchamia srodowisko aplikacji,
- wykonuje testy API i E2E,
- generuje raport Allure i publikuje go na GitHub Pages.

Publiczny link do raportu:
https://mstawars.github.io/ttapi/

## Raport Allure

```bash
cd tests
npm run report:generate
npm run report:open
```

## Uwagi

- Czesc testow API failuje z dwoch powodow:
   - poniewaz logika zmiany statusu po utworzeniu na acknowledged i rejected wymaga wyjasnienia, przyjeto zgodnie z trescia przekazaną w pliku TASK.md  "Po utworzeniu system może automatycznie zmienić status na `acknowledged`" ze po utworzeniu ticket powinien miec status acknowledged, nie rejected. 
   - mozliwe jest dodanie ticketu o niepoprawnym serviceId, poza określonym w tresci TASK.md zakresem: "W środowisku testowym akceptowane są wartości: **100001 – 100030**"
- Testy uzywaja unikalnych `externalId` (UUID), aby ograniczyc kolizje danych.
# Strategia Testów — Trouble Ticket API

**Dokument:** Strategia Testów (Część 1)  
**Wersja:** 1.0  
**Data:** 2026-06-24  
**Autor:** Starszy Tester Automatyzacji  
**Aplikacja:** Trouble Ticket API v1.0.0

---

## 1. Identyfikacja obszarów do testowania

### 1.1 Mapa komponentów systemu

System składa się z czterech warstw, z których każda wymaga pokrycia testami:

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (React SPA)                                    │
│  — formularz tworzenia, lista, szczegóły, zamykanie,    │
│    dodawanie notatek                                     │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP / JSON
┌────────────────────────▼─────────────────────────────────┐
│  REST API (Spring Boot 4.0.5 / Java 21)                  │
│  — TroubleTicketController, TroubleTicketNoteController  │
│  — GlobalExceptionHandler, SecurityConfig               │
│  — TroubleTicketService, TicketStatusResolver            │
└──────────┬─────────────────────────┬─────────────────────┘
           │ OAuth2/OIDC JWT          │ JPA / JDBC
┌──────────▼──────────┐   ┌──────────▼──────────────────┐
│  Keycloak (OIDC)    │   │  PostgreSQL 18               │
│  — realm ttapi      │   │  — trouble_ticket schema     │
│  — tenant_id claim  │   │  — Liquibase migrations      │
└─────────────────────┘   └──────────────────────────────┘
```

### 1.2 Obszary funkcjonalne

| ID | Obszar | Komponenty | Złożoność |
|----|--------|-----------|-----------|
| A1 | **Tworzenie zgłoszeń** | `POST /troubleTicket`, `TroubleTicketService.create()` | Wysoka |
| A2 | **Listowanie zgłoszeń** | `GET /troubleTicket` | Niska |
| A3 | **Szczegóły zgłoszenia** | `GET /troubleTicket/{id}` | Niska |
| A4 | **Zamykanie zgłoszeń** | `PATCH /troubleTicket/{id}`, `TicketStatusResolver` | Wysoka |
| A5 | **Notatki** | `POST /troubleTicket/{id}/note` | Średnia |
| A6 | **Multi-tenancy / izolacja danych** | `TenantExtractor`, `SecurityConfig` | Krytyczna |
| A7 | **Bezpieczeństwo / autoryzacja** | Keycloak JWT, `SecurityConfig` | Krytyczna |
| A8 | **Walidacja danych wejściowych** | `GlobalExceptionHandler`, kontrakty OpenAPI | Wysoka |
| A9 | **Idempotencja tworzenia** | `TroubleTicketService.create()`, unikalna para `(tenantId, externalId)` | Wysoka |
| A10 | **UI – widok listy zgłoszeń** | `TicketListPage.tsx`, `StatusChip.tsx` | Średnia |
| A11 | **UI – formularz tworzenia** | `CreateTicketPage.tsx` | Średnia |
| A12 | **UI – szczegóły i notatki** | `TicketDetailPage.tsx` | Średnia |
| A13 | **Kody błędów API** | `GlobalExceptionHandler`, error schema | Wysoka |

---

## 2. Priorytetyzacja

Priorytety wyznaczono według kombinacji **ryzyka biznesowego**, **prawdopodobieństwa defektu** i **trudności naprawy** po wdrożeniu.

### 2.1 Macierz priorytetów

| Priorytet | Obszary | Uzasadnienie |
|-----------|---------|--------------|
| **P1 – Krytyczny** | A6, A7 | Naruszenie izolacji tenantów lub autoryzacji prowadzi do wycieku danych klientów — konsekwencje prawne (RODO) i reputacyjne nie do odwrócenia. |
| **P1 – Krytyczny** | A1, A4 | Tworzenie i zamykanie zgłoszeń to core-flow produktu; błędy bezpośrednio uniemożliwiają pracę operatorów. |
| **P2 – Wysoki** | A8, A9, A13 | Błędna walidacja i błędne kody błędów psują kontrakty API i utrudniają integracje zewnętrzne. |
| **P2 – Wysoki** | A5 | Notatki są podstawowym kanałem komunikacji — błędy reguły „closed/rejected/resolved" mogą prowadzić do utraty informacji. |
| **P3 – Średni** | A2, A3 | Odczyt jest niżej ryzykowny, ale błędy w liście / szczegółach degradują UX. |
| **P3 – Średni** | A10, A11, A12 | UI stanowi cienką warstwę nad API; błędy są widoczne, ale mniej krytyczne niż błędy backendowe. |

### 2.2 Reguły biznesowe o najwyższym priorytecie walidacji

1. Tenant scope pochodzi **wyłącznie** z JWT claim `tenant_id` — nie z parametrów żądania.  
2. Zamknięcie (`closed`) jest dozwolone **tylko** z `acknowledged` lub `inProgress`.  
3. Notatki są dozwolone **tylko** w `new`, `acknowledged`, `inProgress`.  
4. Idempotencja: para `(tenantId, externalId)` musi zwracać HTTP 200 (nie 201) przy powtórnym żądaniu.  
5. Próba dostępu do zasobu innego tenanta zwraca **HTTP 404** (nie 403).

---

## 3. Podejście do testowania

### 3.1 Piramida testów

```
                    ┌──────────┐
                    │  E2E UI  │  ~5%   (Playwright/Cypress)
                  ┌─┴──────────┴─┐
                  │  API Black   │  ~25%  (REST Assured / Axios)
                  │  Box Tests   │
                ┌─┴──────────────┴─┐
                │ Integracyjne     │  ~40%  (Spring Boot Test + Testcontainers)
                │ (MockMvc + JPA)  │
              ┌─┴──────────────────┴─┐
              │  Jednostkowe (unit)  │  ~30%  (JUnit 5 + Mockito)
              └──────────────────────┘
```

Podejście jest **test-in-the-middle** — największy wkład testów integracyjnych wynika z tego, że aplikacja jest silnie zintegrowana (Spring Security + JPA + Liquibase) i logika biznesowa jest rozłożona pomiędzy warstwy.

### 3.2 Typy testów i uzasadnienie

#### 3.2.1 Testy jednostkowe (Unit Tests)
**Technologia:** JUnit 5, Mockito  
**Zakres:**
- `TicketStatusResolver` / `ParityTicketStatusResolver` — czysty automat stanów, testowany bez kontenera
- `TenantExtractor` — ekstrakcja claima z mockowanego JWT
- Logika walidacji w mapper-ach / serwisach

**Dlaczego:** Szybkie (< 1 ms/test), deterministyczne, natychmiastowy feedback przy zmianach w automacie stanów.

#### 3.2.2 Testy integracyjne Spring (Integration Tests z MockMvc)
**Technologia:** `@SpringBootTest`, `@AutoConfigureMockMvc`, Testcontainers (PostgreSQL), `spring-security-test`  
**Zakres:**
- Pełne scenariusze CRUD przez MockMvc z prawdziwą bazą danych
- Izolacja tenantów (JWT z różnymi `tenant_id`)
- Reguły przejść statusów end-to-end przez warstwę kontrolera
- Walidacja struktury odpowiedzi (status HTTP, nagłówki, body JSON)

**Dlaczego:** Testcontainers eliminuje konieczność mocków bazy danych, zapewniając wierność środowiska. MockMvc jest szybsze od pełnego stosu HTTP.

#### 3.2.3 Testy API Black-Box (Contract/E2E API Tests)
**Technologia:**  Playwright (TypeScript)  
**Zakres:**
- Testy działające względem uruchomionego środowiska Docker Compose
- Pełny przepływ OAuth2 (uzyskanie tokenu z Keycloak)
- Weryfikacja zgodności z kontraktem OpenAPI (response schema validation)
- Multi-tenant scenariusze z różnymi użytkownikami (alpha, beta, gamma)
- Negatywne ścieżki (4xx) wymagające rzeczywistego stanu serwera
- Asercje bezpośrednio na bazie danych, np. weryfikacja liczby rekordów dla `externalId` i tenantów

**Dlaczego:** Jedyne testy weryfikujące działanie całego stosu (Keycloak + Spring Boot + PostgreSQL) razem.

#### 3.2.4 Testy E2E interfejsu użytkownika
**Technologia:** Playwright (TypeScript)  
**Zakres:**
- Krytyczne user journeys: logowanie → tworzenie zgłoszenia → dodanie notatki → zamknięcie
- Weryfikacja wyświetlania statusów (`StatusChip`)
- Obsługa błędów walidacji formularza (pola obowiązkowe, błędne serviceId)
- Responsywność i dostępność (a11y smoke test)

**Dlaczego:** Playwright oferuje pełną kontrolę przeglądarki, auto-waiting i wsparcie dla TypeScript (spójność z kodem frontendowym). Zakres jest celowo wąski — E2E testy są drogie w utrzymaniu.

#### 3.2.5 Testy bezpieczeństwa (Security Tests)
**Technologia:** REST Assured / curl + skrypty  
**Zakres:**
- Brak tokenu → HTTP 401
- Wygasły token → HTTP 401
- Token bez `tenant_id` claim → zachowanie aplikacji
- Próba dostępu do zasobu innego tenanta → HTTP 404 (nie 403)
- SQL Injection w polach tekstowych (OWASP Top 10 A03)
- Oversized payload (DoS protection)

---

## 4. Ryzyka i wyzwania

### 4.1 Ryzyka techniczne

| ID | Ryzyko | Prawdopodobieństwo | Wpływ | Mitigacja |
|----|--------|-------------------|-------|-----------|
| R1 | **Luki w izolacji tenantów** — błąd w `TenantExtractor` lub zapytaniu JPA może ujawnić dane innego tenanta | Średnie | Krytyczny | Dedykowane testy izolacji (cross-tenant GET/PATCH/POST) jako testy blokujące CI |
| R2 | **Niespójny automat stanów** — nowe przejście dodane bez aktualizacji reguł w `TicketStatusResolver` | Niskie | Wysoki | Parametryczne testy jednostkowe pokrywające wszystkie kombinacje statusów |
| R3 | **Idempotencja w scenariuszach race-condition** — równoległe żądania z tym samym `externalId` mogą tworzyć duplikaty | Niskie | Wysoki | Test współbieżny (2 wątki, ten sam payload) w testach integracyjnych |
| R4 | **Regresja kontraktu OpenAPI** — zmiana modelu bez aktualizacji specyfikacji | Średnie | Wysoki | Walidacja response schema w testach API (np. Atlassian `swagger-request-validator`) |
| R5 | **Fluktuacja środowiska Docker** — Keycloak lub PostgreSQL nie jest gotowy przy starcie testów | Wysokie | Średni | Health-check w skryptach testowych + retry logic przy uzyskiwaniu tokenu |
| R6 | **Migracje Liquibase** — błędny skrypt SQL blokuje start aplikacji | Niskie | Wysoki | Test `@SpringBootTest` weryfikuje sam start kontekstu jako smoke test |
| R7 | **Brak paginacji w listowaniu** — przy dużej liczbie zgłoszeń odpowiedź może być bardzo duża | Średnie | Niski | Test wydajności (30+ zgłoszeń) weryfikujący czas odpowiedzi < 500 ms |
| R8 | **Wyciek informacji w błędach 404** — 404 zamiast 403 ukrywa istnienie zasobu, ale treść body musi być generyczna | Niskie | Średni | Weryfikacja, że body 404 nie zawiera informacji przynależących do innego tenanta |

### 4.2 Wyzwania organizacyjne

| Wyzwanie | Opis | Podejście |
|----------|------|-----------|
| **Zarządzanie tokenami** | Każdy test API musi uzyskać ważny token z Keycloak; tokeny mają TTL | Współdzielony `TokenProvider` z cache'owaniem na czas sesji testowej |
| **Różne środowiska** | Adresy i credentiale do Keycloak oraz PostgreSQL mogą różnić się między lokalnym uruchomieniem, CI i stagingiem | Konfiguracja przez zmienne środowiskowe (`KC_*`, `DB_*`) zamiast wartości zaszytych w kodzie |
| **Stan bazy danych** | Testy integracyjne i E2E mogą interferować ze sobą | MockMvc: `@BeforeEach deleteAll()` / Testcontainers: izolowany kontener per sesja; API E2E: unikalne `externalId` per test (np. UUID prefix) |
| **Niestabilność E2E** | Asynchroniczność frontendu (React) może powodować `flaky tests` | Playwright `waitForSelector` / `expect(locator).toBeVisible()` zamiast `sleep()` |
| **Brak paginacji** | Lista zgłoszeń zwraca wszystkie dane — testy muszą zakładać czysty stan lub filtrować po `externalId` | Strategia: unikalne `externalId` z prefiksem testowym |

### 4.3 Niejednoznaczność dokumentacji statusów po utworzeniu

W dokumentacji biznesowej istnieje niejednoznaczność dotycząca statusu po utworzeniu zgłoszenia:

- W schemacie przejść statusów widoczne jest możliwe przejście z `new` do `rejected`.
- W opisie tekstowym występuje jedynie krótka notka:
  - Po utworzeniu system może automatycznie zmienić status na `acknowledged`.
- Brakuje jednoznacznie opisanych reguł, kiedy i dlaczego status miałby przejść do `rejected`.

Na potrzeby testów przyjęto założenie robocze:

- Status `rejected` po utworzeniu zgłoszenia jest traktowany jako błąd.
- Testy mają failować, jeżeli odpowiedź po utworzeniu zawiera status `rejected`.
- Po doprecyzowaniu dokumentacji testy zostaną dostosowane do uzgodnionych reguł.

---

## 5. Propozycja scenariuszy testowych

### 5.1 Obszar: Tworzenie zgłoszeń (A1)

| ID | Tytuł | Typ | Ścieżka | Priorytet |
|----|-------|-----|---------|-----------|
| TC-001 | Utworzenie zgłoszenia z poprawnymi danymi (test parametryczny dla różnych `serviceId`) zwraca HTTP 201 i nagłówek `Location` | Integracyjny | Pozytywna | P1 |
| TC-002 | Nowo utworzone zgłoszenie ma status `new` lub `acknowledged` (status `rejected` traktowany jako błąd do wyjaśnienia) | Integracyjny | Pozytywna | P1 |
| TC-003 | Próba tworzenia z `status != "new"` zwraca HTTP 400 i kod `VALIDATION_ERROR` | Integracyjny | Negatywna | P1 |
| TC-004 | Brak wymaganego pola (`externalId`) zwraca HTTP 400 i kod `VALIDATION_ERROR` | Integracyjny | Negatywna | P2 |
| TC-005 | Tworzenie z `serviceId` spoza zakresu 100001–100030 zwraca HTTP 404 `SERVICE_NOT_FOUND` | API Black-Box | Negatywna | P2 |
| TC-012 | Tworzenie z `serviceId` spoza zakresu 100001–100030 zwraca błąd 4xx (test kontraktowy względem TASK) | API Black-Box | Negatywna | P2 |
| TC-006 | Brak tokenu przy tworzeniu zwraca HTTP 401 | Integracyjny | Negatywna | P1 |

### 5.2 Obszar: Idempotencja (A9)

| ID | Tytuł | Typ | Ścieżka | Priorytet |
|----|-------|-----|---------|-----------|
| TC-010 | Powtórne żądanie z tym samym `(tenantId, externalId)` zwraca HTTP 200 z istniejącym zasobem | Integracyjny | Pozytywna | P1 |
| TC-011 | Ten sam `externalId` dla różnych tenantów tworzy dwa niezależne zgłoszenia (HTTP 201 dla obu) | Integracyjny | Pozytywna | P1 |
| TC-012 | Współbieżne żądania tworzenia z tym samym `externalId` nie tworzą duplikatu | Integracyjny | Edge case | P2 |

### 5.3 Obszar: Zamykanie zgłoszeń — przejścia statusów (A4)

| ID | Tytuł | Typ | Ścieżka | Priorytet |
|----|-------|-----|---------|-----------|
| TC-020 | Zamknięcie zgłoszenia w statusie `acknowledged` zwraca HTTP 200 ze statusem `closed` | Integracyjny | Pozytywna | P1 |
| TC-021 | Zamknięcie zgłoszenia w statusie `inProgress` zwraca HTTP 200 ze statusem `closed` | Integracyjny | Pozytywna | P1 |
| TC-022 | Po zamknięciu do zgłoszenia jest automatycznie dodana notatka systemowa | Integracyjny | Pozytywna | P2 |
| TC-023 | Próba zamknięcia zgłoszenia w statusie `new` zwraca HTTP 400 `STATUS_TRANSITION_ERROR` | Integracyjny | Negatywna | P1 |
| TC-024 | Próba zamknięcia zgłoszenia w statusie `resolved` zwraca HTTP 400 `STATUS_TRANSITION_ERROR` | Integracyjny | Negatywna | P1 |
| TC-025 | Próba zamknięcia zgłoszenia w statusie `rejected` zwraca HTTP 400 `STATUS_TRANSITION_ERROR` | Integracyjny | Negatywna | P1 |
| TC-026 | Próba zamknięcia już zamkniętego zgłoszenia (`closed`) zwraca HTTP 400 `STATUS_TRANSITION_ERROR` | Integracyjny | Negatywna | P1 |
| TC-027 | Próba zmiany statusu na inny niż `closed` w PATCH zwraca HTTP 400 `VALIDATION_ERROR` | Integracyjny | Negatywna | P2 |

### 5.4 Obszar: Notatki (A5)

| ID | Tytuł | Typ | Ścieżka | Priorytet |
|----|-------|-----|---------|-----------|
| TC-030 | Dodanie notatki do zgłoszenia w statusie `new` zwraca HTTP 201 | Integracyjny | Pozytywna | P2 |
| TC-031 | Dodanie notatki do zgłoszenia w statusie `acknowledged` zwraca HTTP 201 | Integracyjny | Pozytywna | P2 |
| TC-032 | Dodanie notatki do zgłoszenia w statusie `inProgress` zwraca HTTP 201 | Integracyjny | Pozytywna | P2 |
| TC-033 | Próba dodania notatki do zgłoszenia `closed` zwraca HTTP 400 `NOTE_ADDITION_NOT_ALLOWED` | Integracyjny | Negatywna | P1 |
| TC-034 | Próba dodania notatki do zgłoszenia `resolved` zwraca HTTP 400 `NOTE_ADDITION_NOT_ALLOWED` | Integracyjny | Negatywna | P1 |
| TC-035 | Próba dodania notatki do zgłoszenia `rejected` zwraca HTTP 400 `NOTE_ADDITION_NOT_ALLOWED` | Integracyjny | Negatywna | P1 |
| TC-036 | Dodana notatka jest widoczna w szczegółach zgłoszenia (GET) | Integracyjny | Pozytywna | P2 |
| TC-037 | Nota z pustym `text` zwraca HTTP 400 `VALIDATION_ERROR` | Integracyjny | Negatywna | P3 |

### 5.5 Obszar: Multi-tenancy i izolacja danych (A6)

| ID | Tytuł | Typ | Ścieżka | Priorytet |
|----|-------|-----|---------|-----------|
| TC-040 | Tenant B nie widzi zgłoszeń Tenanta A na liście | Integracyjny | Negatywna | P1 |
| TC-041 | Tenant B nie może pobrać szczegółów zgłoszenia Tenanta A (HTTP 404, nie 403) | Integracyjny | Negatywna | P1 |
| TC-042 | Tenant B nie może zamknąć zgłoszenia Tenanta A (HTTP 404) | Integracyjny | Negatywna | P1 |
| TC-043 | Tenant B nie może dodać notatki do zgłoszenia Tenanta A (HTTP 404) | Integracyjny | Negatywna | P1 |
| TC-044 | Body odpowiedzi 404 dla zasobu innego tenanta nie zawiera danych tego zasobu | API Black-Box | Negatywna | P1 |
| TC-045 | Trzeci tenant (gamma) jest izolowany od alpha i beta | API Black-Box | Pozytywna | P2 |

### 5.6 Obszar: Autoryzacja i bezpieczeństwo (A7)

| ID | Tytuł | Typ | Ścieżka | Priorytet |
|----|-------|-----|---------|-----------|
| TC-050 | Żądanie bez tokenu zwraca HTTP 401 na każdym endpoincie | Integracyjny | Negatywna | P1 |
| TC-051 | Żądanie z nieprawidłowym tokenem (zmodyfikowana sygnatura) zwraca HTTP 401 | API Black-Box | Negatywna | P1 |
| TC-052 | Żądanie z wygasłym tokenem zwraca HTTP 401 | API Black-Box | Negatywna | P1 |
| TC-053 | Token bez claimu `tenant_id` — weryfikacja zachowania aplikacji | API Black-Box | Edge case | P2 |
| TC-054 | Payload zawierający SQL Injection w `description` jest bezpiecznie obsłużony | Integracyjny | Negatywna | P1 |

### 5.7 Obszar: Walidacja i kody błędów (A8, A13)

| ID | Tytuł | Typ | Ścieżka | Priorytet |
|----|-------|-----|---------|-----------|
| TC-060 | Każda odpowiedź błędu zawiera pola `code` i `requestId` | Integracyjny | Pozytywna | P2 |
| TC-061 | Żądanie z nieprawidłowym Content-Type zwraca HTTP 415 lub 400 | Integracyjny | Negatywna | P3 |
| TC-062 | Puste body żądania POST zwraca HTTP 400 `VALIDATION_ERROR` | Integracyjny | Negatywna | P2 |
| TC-063 | Bardzo długi string w `description` (> 10 000 znaków) — weryfikacja obsługi | Integracyjny | Edge case | P3 |

### 5.8 Obszar: UI — lista zgłoszeń (A10)

| ID | Tytuł | Typ | Ścieżka | Priorytet |
|----|-------|-----|---------|-----------|
| TC-070 | Po zalogowaniu lista zgłoszeń wyświetla się i zawiera elementy z odpowiednim statusem | E2E (Playwright) | Pozytywna | P2 |
| TC-071 | `StatusChip` wyświetla poprawny kolor dla każdego statusu | E2E (Playwright) | Pozytywna | P3 |
| TC-072 | Kliknięcie zgłoszenia na liście przenosi do widoku szczegółów | E2E (Playwright) | Pozytywna | P2 |

### 5.9 Obszar: UI — formularz tworzenia (A11)

| ID | Tytuł | Typ | Ścieżka | Priorytet |
|----|-------|-----|---------|-----------|
| TC-080 | Formularz z poprawnymi danymi tworzy zgłoszenie i wyświetla potwierdzenie | E2E (Playwright) | Pozytywna | P2 |
| TC-081 | Próba wysłania pustego formularza wyświetla komunikaty walidacyjne | E2E (Playwright) | Negatywna | P2 |
| TC-082 | Po pomyślnym utworzeniu użytkownik jest przekierowany do listy lub szczegółów | E2E (Playwright) | Pozytywna | P3 |

### 5.10 Obszar: UI — szczegóły i notatki (A12)

| ID | Tytuł | Typ | Ścieżka | Priorytet |
|----|-------|-----|---------|-----------|
| TC-090 | Widok szczegółów wyświetla wszystkie pola i historię notatek | E2E (Playwright) | Pozytywna | P2 |
| TC-091 | Przycisk „Zamknij" jest widoczny dla statusów `acknowledged` i `inProgress` | E2E (Playwright) | Pozytywna | P2 |
| TC-092 | Przycisk „Zamknij" jest niewidoczny lub nieaktywny dla statusów `closed`, `rejected`, `resolved` | E2E (Playwright) | Negatywna | P2 |
| TC-093 | Dodanie notatki przez UI wyświetla ją natychmiast na liście notatek | E2E (Playwright) | Pozytywna | P2 |

---

## 6. Narzędzia i stos technologiczny

| Warstwa testów | Technologia | Uzasadnienie |
|----------------|-------------|--------------|
| Unit (Java) | JUnit 5, Mockito | Standard w ekosystemie Spring; spójny z kodem produkcyjnym |
| Integracyjne (Java) | Spring Boot Test, MockMvc, Testcontainers, `spring-security-test` | Istniejąca infrastruktura w projekcie (`TroubleTicketIntegrationTest.java`) |
| API Black-Box | Playwright + TypeScript |+ Playwright oferuje prosty i czytelny API client z wbudowanymi mechanizmami testowymi (fixtures, retries, steps) |
| E2E UI | Playwright (TypeScript) | Spójność z frontendem TS; stabilne API, auto-waiting, trace viewer |
| Kontrakt OpenAPI | `atlassian-swagger-request-validator` lub `openapi4j` | Automatyczna walidacja response względem `trouble-ticket-api.yaml` |
| CI | GitHub Actions / GitLab CI | Uruchomienie testów integracyjnych z Testcontainers i testów E2E z Docker Compose |

---

## 7. Metryki pokrycia i kryteria wyjścia

| Metryka | Wartość docelowa |
|---------|-----------------|
| Pokrycie kodu (unit + integracyjne) | ≥ 80% linii dla warstw `service` i `controller` |
| Pokrycie reguł biznesowych (statusy, notatki, idempotencja) | 100% zdefiniowanych przejść |
| Scenariusze negatywne (4xx) | Co najmniej 1 negatywna ścieżka na każdy endpoint |
| Testy izolacji tenantów | Wszystkie 4 endpointy weryfikowane cross-tenant |
| Flakiness E2E | < 2% przy 10 uruchomieniach z rzędu |

**Kryteria blokujące wydanie (P1):**
- Żaden test z priorytetem P1 nie może być `FAIL`
- Brak niezamkniętych defektów kategorii Blocker lub Critical
- Raport pokrycia musi być opublikowany i zaakceptowany

---

## 8. Ograniczenia i założenia

- Testy API Black-Box wymagają uruchomionego środowiska Docker Compose (Keycloak + Backend + PostgreSQL).
- Środowisko testowe Keycloak jest predefiniowane (`realm-ttapi.json`); testy nie modyfikują konfiguracji realm.
- Testy E2E zakładają dostępność frontendu pod `http://localhost:3000`.
- Predefiniowane dane testowe (30 zgłoszeń z migracji SQL) mogą być używane, ale każdy test tworzący dane używa unikalnego `externalId` (prefiks UUID) aby unikać kolizji.
- Zakres v1 API nie obejmuje paginacji ani filtrowania — testy listowania zakładają ograniczoną liczbę zgłoszeń lub weryfikują obecność konkretnych elementów zamiast dokładnej liczby.

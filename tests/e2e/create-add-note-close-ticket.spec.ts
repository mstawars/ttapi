/**
 * E2E testy – Zarządzanie zgłoszeniami (Ticket Lifecycle)
 *
 * Środowisko: http://localhost:3000 (React SPA + Keycloak)
 *
 * Struktura testów – 3 niezależne scenariusze:
 *
 * Test 1: Tworzenie i zamknięcie zgłoszenia
 *  - Tworzenie nowego zgłoszenia przez formularz UI
 *  - Weryfikacja statusu (acknowledged)
 *  - Zamknięcie zgłoszenia przez przycisk UI
 *  - Weryfikacja zmiany statusu na "Zamknięte"
 *
 * Test 2: Dodanie notatki do zgłoszenia w statusie inProgress
 *  - Nawigacja do seedowanego ticketu (FIXTURE-E2E-INPROGRESS)
 *  - Dodanie notatki do zgłoszenia w statusie inProgress
 *  - Weryfikacja wyświetlenia notatki
 *  - Uwaga: zgłoszenie jest seedowane przez global-setup.ts bezpośrednio do PostgreSQL
 *    (status inProgress nie można ustawić przez API)
 *
 * Test 3: Brak możliwości dodania notatki do zamkniętego zgłoszenia
 *  - Nawigacja do fixture zamkniętego ticketu
 *  - Weryfikacja że pole tekstowe do notatki jest ukryte
 *  - Weryfikacja że przycisk "Dodaj notatkę" jest ukryty
 *  - Fixture ticket jest tworzony przez API (acknowledged) i zamykany przed testem
 *
 * Izolacja danych:
 *  - Test 1: Tworzy własny ticket przy każdym uruchomieniu
 *  - Test 2: Używa seedowanego ticketu z global-setup.ts
 *  - Test 3: Używa dynamicznego fixture'u z helpers/fixtures.ts
 *  - Brak współdzielenia stanu między testami
 *
 * Mapowanie statusów UI (StatusChip.tsx):
 *  acknowledged → "Przyjęte"
 *  inProgress   → "W toku"
 *  closed       → "Zamknięte"
 */

import { test } from '../helpers/fixtures';
import { feature, story, description, severity } from "allure-js-commons";
import { randomUUID } from 'node:crypto';
import { FIXTURES } from '../helpers/fixtures';
import { LoginPage } from './pages/LoginPage';
import { TicketListPage } from './pages/TicketListPage';
import { CreateTicketPage } from './pages/CreateTicketPage';
import { TicketDetailPage } from './pages/TicketDetailPage';

// ─────────────────────────────────────────────────────────────────────────────

test.describe('E2E - Pełna ścieżka obsługi zgłoszenia', () => {
  let loginPage: LoginPage;
  let ticketDetailPage: TicketDetailPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    ticketDetailPage = new TicketDetailPage(page);

    // Logowanie do aplikacji jako tenant 'alpha' z konfiguracji
    await loginPage.goto();
    await loginPage.loginByTenant('alpha');
  });

  test(
    'Logowanie → Tworzenie zgłoszenia → Notatka → Zamknięcie',
    async ({ page }) => {
      await feature('Obsługa zgłoszenia - tworzenie i zamknięcie');
      await story('E2E - ticket lifecycle');
      await severity('blocker');
      await description(
        'Testuje przepływ tworzenia nowego zgłoszenia przez formularz UI, dodanie notatki ' +
        'oraz jego zamknięcie przyciskiem "Zamknij zgłoszenie".',
      );

      const ticketListPage = new TicketListPage(page);
      const createTicketPage = new CreateTicketPage(page);

      const newExternalId = `E2E-${randomUUID()}`;

      await test.step('Nawigacja do formularza tworzenia zgłoszenia', async () => {
        await ticketListPage.clickNewTicket();
        await createTicketPage.waitForReady();
      });

      await test.step('Wypełnienie i przesłanie formularza', async () => {
        await createTicketPage.fill({
          externalId: newExternalId,
          serviceId: '100002',
          description: 'E2E test - tworzenie zgłoszenia',
        });
        await createTicketPage.submit();
      });

      await test.step('Weryfikacja - nowe zgłoszenie ma status "Przyjęte"', async () => {
        await ticketDetailPage.waitForTicket(newExternalId);
        await ticketDetailPage.expectStatus('Przyjęte');
      });
      const noteContent = `E2E notatka testowa ${randomUUID()}`;

      await test.step('Dodanie notatki do zgłoszenia', async () => {
        await ticketDetailPage.addNote(noteContent);
      });

      await test.step('Weryfikacja - notatka wyświetla się na liście', async () => {
        await ticketDetailPage.expectNoteVisible(noteContent);
      });

      await test.step('Zamknięcie zgłoszenia przyciskiem "Zamknij zgłoszenie"', async () => {
        await ticketDetailPage.closeTicket();
      });

      await test.step('Weryfikacja - status zmienił się na "Zamknięte"', async () => {
        await ticketDetailPage.expectClosedState();
      });
    },
  );

  test(
    'Dodanie notatki do zgłoszenia w statusie inProgress',
    async ({ page }) => {
      await feature('Notatki');
      await story('E2E - dodanie notatki do inProgress');
      await severity('high');
      await description(
        'Weryfikacja możliwości dodania notatki do zgłoszenia w statusie inProgress. ' +
          'Zgłoszenie jest seedowane przez global-setup.ts bezpośrednio do bazy danych.',
      );

      await test.step(
        `Nawigacja do zgłoszenia ${FIXTURES.NOTE_INPROGRESS} (status: inProgress)`,
        async () => {
          await ticketDetailPage.goto(FIXTURES.NOTE_INPROGRESS);
          await ticketDetailPage.waitForTicket(FIXTURES.NOTE_INPROGRESS);
          await ticketDetailPage.expectStatus('W toku');
        },
      );

      const noteContent = `E2E notatka do inProgress ${randomUUID()}`;

      await test.step('Dodanie notatki do zgłoszenia w statusie inProgress', async () => {
        await ticketDetailPage.addNote(noteContent);
      });

      await test.step('Weryfikacja - notatka wyświetla się na liście', async () => {
        await ticketDetailPage.expectNoteVisible(noteContent);
      });
    },
  );

  test(
    'Brak możliwości dodania notatki do zamkniętego zgłoszenia',
    async ({ page, closedTicket }) => {
      await feature('Notatki');
      await story('E2E - kontrola dostępu do notatek');
      await severity('medium');
      await description(
        'Weryfikacja że dla zgłoszenia w statusie closed nie istnieje możliwość dodania notatki: ' +
          'zarówno pole tekstowe jak i przycisk "Dodaj notatkę" są ukryte.',
      );

      await test.step(`Nawigacja do ticketu ${closedTicket} (status: closed)`, async () => {
        await ticketDetailPage.goto(closedTicket);
        await ticketDetailPage.waitForTicket(closedTicket);
        await ticketDetailPage.expectStatus('Zamknięte');
      });

      await test.step('Weryfikacja - pole tekstowe do notatki jest ukryte dla closed ticketu', async () => {
        await ticketDetailPage.expectNoteTextareaNotVisible();
      });

      await test.step('Weryfikacja - przycisk "Dodaj notatkę" jest ukryty dla closed ticketu', async () => {
        await ticketDetailPage.expectAddNoteButtonNotVisible();
      });
    },
  );
});

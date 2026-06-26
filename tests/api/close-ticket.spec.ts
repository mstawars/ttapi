/**
 * API tests – Zamykanie zgłoszenia (Close Ticket)
 *
 * Endpoint: PATCH /api/v1/troubleTicket/{id}   body: { "status": "closed" }
 *
 * Reguła biznesowa:
 *  Zamknięcie jest dozwolone TYLKO z statusów: acknowledged lub inProgress.
 *  Próba zamknięcia z innego statusu zwraca HTTP 400 z kodem STATUS_TRANSITION_ERROR.
 *
 * Scenariusze:
 *  TC-020 – Zamknięcie z acknowledged → HTTP 200, status=closed
 *  TC-021 – Zamknięcie z inProgress   → HTTP 200, status=closed
 *  TC-023 – Zamknięcie z rejected     → HTTP 400, STATUS_TRANSITION_ERROR
 *  TC-024 – Zamknięcie z resolved     → HTTP 400, STATUS_TRANSITION_ERROR
 *  TC-026 – Zamknięcie już closed     → HTTP 400, STATUS_TRANSITION_ERROR
 *
 * Izolacja danych:
 *  TC-020: fixture 'acknowledgedTicket'       – nowy ticket tworzony przez API przed każdym testem
 *  TC-021: FIXTURES.CLOSE_INPROGRESS          – seedowany przez global-setup.ts, dedykowany
 *  TC-023: FIXTURES.REJECTED                  – seedowany przez global-setup.ts (wyłącznie testy 400)
 *  TC-024: FIXTURES.RESOLVED                  – seedowany przez global-setup.ts (wyłącznie testy 400)
 *  TC-026: fixture 'closedTicket'             – nowy acknowledged ticket, zamknięty przed testem
 *
 * Każdy test korzysta z własnych, izolowanych danych.
 * global-setup.ts resetuje FIXTURE-* tickety przed każdym uruchomieniem.
 */

import { test, expect, FIXTURES } from '../helpers/fixtures';
import { feature, story, description, severity } from "allure-js-commons";;
import { closeTicket } from '../helpers/ticket-api';

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Zamykanie zgłoszenia - PATCH /api/v1/troubleTicket/{id}', () => {
  test(
    'TC-020: Zamknięcie ze statusu acknowledged → HTTP 200, status=closed',
    async ({ request, acknowledgedTicket }) => {
      await feature('Zamykanie zgłoszeń');
      await story('Ścieżka pozytywna');
      await severity('critical');
      await description(
        'Zgłoszenie w statusie acknowledged może zostać zamknięte przez klienta API. ' +
          'Odpowiedź powinna zawierać HTTP 200 i status=closed.',
      );

      const response = await test.step(
        `PATCH /troubleTicket/${acknowledgedTicket} { status: closed }`,
        async () => closeTicket(request, 'alpha', acknowledgedTicket),
      );

      await test.step('Weryfikacja odpowiedzi', async () => {
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.status).toBe('closed');
        expect(body.externalId).toBe(acknowledgedTicket);
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────

  test(
    'TC-021: Zamknięcie ze statusu inProgress → HTTP 200, status=closed',
    async ({ request }) => {
      await feature('Zamykanie zgłoszeń');
      await story('Ścieżka pozytywna');
      await severity('critical');
      await description(
        'Zgłoszenie w statusie inProgress może zostać zamknięte przez klienta API. ' +
          `Używa dedykowanego fixture ticketu '${FIXTURES.CLOSE_INPROGRESS}' ` +
          'seedowanego przez global-setup.ts przed każdym uruchomieniem.',
      );

      const response = await test.step(
        `PATCH /troubleTicket/${FIXTURES.CLOSE_INPROGRESS} { status: closed }`,
        async () => closeTicket(request, 'alpha', FIXTURES.CLOSE_INPROGRESS),
      );

      await test.step('Weryfikacja odpowiedzi', async () => {
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.status).toBe('closed');
        expect(body.externalId).toBe(FIXTURES.CLOSE_INPROGRESS);
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────

  test(
    'TC-023: Zamknięcie ze statusu rejected → HTTP 400, STATUS_TRANSITION_ERROR',
    async ({ request }) => {
      await feature('Zamykanie zgłoszeń');
      await story('Ścieżka negatywna');
      await severity('critical');
      await description(
        'Próba zamknięcia zgłoszenia ze statusu rejected powinna zwrócić HTTP 400 ' +
          'z kodem błędu STATUS_TRANSITION_ERROR.',
      );

      const response = await test.step(
        `PATCH /troubleTicket/${FIXTURES.REJECTED} { status: closed }`,
        async () => closeTicket(request, 'alpha', FIXTURES.REJECTED),
      );

      await test.step('Weryfikacja błędu HTTP 400 i kodu STATUS_TRANSITION_ERROR', async () => {
        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.code).toBe('STATUS_TRANSITION_ERROR');
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────

  test(
    'TC-024: Zamknięcie ze statusu resolved → HTTP 400, STATUS_TRANSITION_ERROR',
    async ({ request }) => {
      await feature('Zamykanie zgłoszeń');
      await story('Ścieżka negatywna');
      await severity('critical');
      await description(
        'Próba zamknięcia zgłoszenia ze statusu resolved powinna zwrócić HTTP 400 ' +
          `z kodem STATUS_TRANSITION_ERROR. Używa fixture '${FIXTURES.RESOLVED}' ` +
          '– operacja 400 nie zmienia statusu ticketu, bezpieczne dla wielokrotnych uruchomień.',
      );

      const response = await test.step(
        `PATCH /troubleTicket/${FIXTURES.RESOLVED} { status: closed }`,
        async () => closeTicket(request, 'alpha', FIXTURES.RESOLVED),
      );

      await test.step('Weryfikacja błędu HTTP 400 i kodu STATUS_TRANSITION_ERROR', async () => {
        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.code).toBe('STATUS_TRANSITION_ERROR');
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────

  test(
    'TC-026: Zamknięcie już zamkniętego zgłoszenia → HTTP 400, STATUS_TRANSITION_ERROR',
    async ({ request, closedTicket }) => {
      await feature('Zamykanie zgłoszeń');
      await story('Ścieżka negatywna');
      await severity('high');
      await description(
        'Próba ponownego zamknięcia zgłoszenia, które jest już w statusie closed, ' +
          'powinna zwrócić HTTP 400 z kodem STATUS_TRANSITION_ERROR. ' +
          "Fixture 'closedTicket' dostarcza już zamknięty ticket.",
      );

      const response = await test.step(
        `PATCH /troubleTicket/${closedTicket} { status: closed } (ticket already closed)`,
        async () => closeTicket(request, 'alpha', closedTicket),
      );

      await test.step('Weryfikacja błędu HTTP 400 i kodu STATUS_TRANSITION_ERROR', async () => {
        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.code).toBe('STATUS_TRANSITION_ERROR');
      });
    },
  );

  const invalidCloseStatuses = ['new', 'acknowledged', 'inProgress', 'resolved', 'rejected'];
  for (const invalidStatus of invalidCloseStatuses) {
    test(
      `TC-027: PATCH ze statusem '${invalidStatus}' zwraca VALIDATION_ERROR`,
      async ({ request, acknowledgedTicket }) => {
        await feature('Zamykanie zgłoszeń');
        await story('Walidacja payloadu');
        await severity('high');
        await description(
          'Endpoint zamykania akceptuje wyłącznie status closed. ' +
            'Przekazanie innej wartości status powinno zwrócić VALIDATION_ERROR.',
        );

        const response = await test.step(
          `PATCH /troubleTicket/${acknowledgedTicket} { status: ${invalidStatus} }`,
          async () => closeTicket(request, 'alpha', acknowledgedTicket, invalidStatus),
        );

        await test.step('Weryfikacja HTTP 4xx i kodu VALIDATION_ERROR', async () => {
          expect(response.status()).toBeGreaterThanOrEqual(400);
          expect(response.status()).toBeLessThan(500);

          const body = await response.json();
          expect(body.code).toBe('VALIDATION_ERROR');
        });
      },
    );
  }
});

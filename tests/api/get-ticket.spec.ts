/**
 * API tests - Pobieranie i listowanie zgłoszeń (Get / List Ticket)
 *
 * Endpointy:
 *  GET /api/v1/troubleTicket/{id}
 *  GET /api/v1/troubleTicket
 *
 * Cel:
 *  Weryfikacja odczytu zgłoszeń oraz izolacji danych pomiędzy tenantami.
 */

import { test, expect } from '../helpers/fixtures';
import { feature, story, description, severity } from 'allure-js-commons';
import { randomUUID } from 'node:crypto';
import { createTicket, getTicket, listTickets } from '../helpers/ticket-api';

function extractExternalIds(body: unknown): string[] {
  if (Array.isArray(body)) {
    return body
      .map((item) => (typeof item === 'object' && item !== null ? (item as { externalId?: string }).externalId : undefined))
      .filter((id): id is string => typeof id === 'string');
  }

  if (typeof body === 'object' && body !== null) {
    const container = body as {
      items?: unknown[];
      content?: unknown[];
      data?: unknown[];
      tickets?: unknown[];
    };

    const candidates = [container.items, container.content, container.data, container.tickets];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate
          .map((item) => (typeof item === 'object' && item !== null ? (item as { externalId?: string }).externalId : undefined))
          .filter((id): id is string => typeof id === 'string');
      }
    }
  }

  return [];
}

test.describe('Pobieranie i listowanie zgłoszeń - GET /api/v1/troubleTicket', () => {
  test(
    'TC-040: Szczegóły własnego zgłoszenia zwracają HTTP 200',
    async ({ request, acknowledgedTicket }) => {
      await feature('Odczyt zgłoszeń');
      await story('Szczegóły zgłoszenia');
      await severity('high');
      await description(
        'Tenant powinien móc pobrać szczegóły własnego zgłoszenia po externalId.',
      );

      const response = await test.step(
        `GET /troubleTicket/${acknowledgedTicket} jako alpha`,
        async () => getTicket(request, 'alpha', acknowledgedTicket),
      );

      await test.step('Weryfikacja HTTP 200 i externalId', async () => {
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.externalId).toBe(acknowledgedTicket);
      });
    },
  );

  test(
    'TC-041: Tenant nie może pobrać szczegółów ticketu innego tenanta',
    async ({ request }) => {
      await feature('Odczyt zgłoszeń');
      await story('Izolacja tenantów');
      await severity('critical');
      await description(
        'Ticket utworzony przez beta nie powinien być dostępny dla alpha przez endpoint szczegółów.',
      );

      const externalId = `TC-041-BETA-${randomUUID()}`;

      await test.step('Utworzenie ticketu jako beta', async () => {
        const createResponse = await createTicket(request, 'beta', {
          externalId,
          serviceId: 100002,
          description: 'TC-041: ticket należący do beta',
          status: 'new',
        });
        expect(createResponse.status()).toBe(201);
      });

      const response = await test.step(
        'Próba GET tego samego ticketu jako alpha',
        async () => getTicket(request, 'alpha', externalId),
      );

      await test.step('Weryfikacja braku dostępu: HTTP 404 + TROUBLE_TICKET_NOT_FOUND', async () => {
        expect(response.status()).toBe(404);
        const body = await response.json();
        expect(body.code).toBe('TROUBLE_TICKET_NOT_FOUND');
      });
    },
  );

  test(
    'TC-042: Listowanie zwraca ticket utworzony przez bieżącego tenanta',
    async ({ request }) => {
      await feature('Odczyt zgłoszeń');
      await story('Listowanie zgłoszeń');
      await severity('high');
      await description(
        'Ticket utworzony przez alpha powinien pojawić się na liście GET /troubleTicket dla alpha.',
      );

      const externalId = `TC-042-ALPHA-${randomUUID()}`;

      await test.step('Utworzenie ticketu jako alpha', async () => {
        const createResponse = await createTicket(request, 'alpha', {
          externalId,
          serviceId: 100002,
          description: 'TC-042: ticket widoczny na liście alpha',
          status: 'new',
        });
        expect(createResponse.status()).toBe(201);
      });

      const response = await test.step('GET /troubleTicket jako alpha', async () =>
        listTickets(request, 'alpha'),
      );

      await test.step('Weryfikacja HTTP 200 i obecności externalId na liście', async () => {
        expect(response.status()).toBe(200);
        const body = await response.json();
        const externalIds = extractExternalIds(body);
        expect(externalIds).toContain(externalId);
      });
    },
  );

  test(
    'TC-043: Listowanie nie zwraca ticketów innego tenanta',
    async ({ request }) => {
      await feature('Odczyt zgłoszeń');
      await story('Izolacja tenantów');
      await severity('critical');
      await description(
        'Ticket utworzony przez beta nie powinien pojawić się na liście GET /troubleTicket dla alpha.',
      );

      const betaExternalId = `TC-043-BETA-${randomUUID()}`;

      await test.step('Utworzenie ticketu jako beta', async () => {
        const createResponse = await createTicket(request, 'beta', {
          externalId: betaExternalId,
          serviceId: 100002,
          description: 'TC-043: ticket beta niewidoczny dla alpha',
          status: 'new',
        });
        expect(createResponse.status()).toBe(201);
      });

      const response = await test.step('GET /troubleTicket jako alpha', async () =>
        listTickets(request, 'alpha'),
      );

      await test.step('Weryfikacja HTTP 200 i braku obcego externalId na liście', async () => {
        expect(response.status()).toBe(200);
        const body = await response.json();
        const externalIds = extractExternalIds(body);
        expect(externalIds).not.toContain(betaExternalId);
      });
    },
  );
});

/**
 * API tests – Tworzenie zgłoszenia (Create Ticket)
 *
 * Endpointy: POST /api/v1/troubleTicket
 *
 * Scenariusze:
 *  TC-001 – Poprawne dane (różne serviceId) → HTTP 201 + kompletna reprezentacja zasobu
 *  TC-010 – Idempotencja: powtórny POST z tym samym externalId → HTTP 200
 *  TC-012 – serviceId poza zakresem 100001-100030 → błąd 4xx
 *  TC-006 – Brak tokenu → HTTP 401
 *
 * Dane testowe:
 *  - poprawne serviceId w środowisku testowym: 100001-100030 (wg TASK.md)
 *  - serviceId testowane parametrycznie dla różnych wartości
 *  - externalId generowany unikalnie (randomUUID) – unikamy kolizji z seed data
 */

import { test, expect } from '@playwright/test';
import { feature, story, description, severity } from "allure-js-commons";
import { randomUUID } from 'node:crypto';
import { createTicket } from '../helpers/ticket-api';
import { createDbConnection } from '../helpers/dbConnection';

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Tworzenie zgłoszenia - POST /api/v1/troubleTicket', () => {
  const db = createDbConnection();
  const users = ['alpha', 'beta', 'gamma'];
  const serviceIds = [100001, 100002, 100015, 100030];

  test.afterAll(async () => {
    await db.close();
  });

  for (const user of users) {
    for (const serviceId of serviceIds) {
      test(
        `TC-001: Poprawne dane zwracają HTTP 201 [user=${user}, serviceId=${serviceId}]`,
        async ({ request }) => {
          await feature('Tworzenie zgłoszeń');
          await story('Ścieżka pozytywna');
          await severity('critical');
          await description(
            'Wysłanie poprawnego payloadu z unikalnym externalId powinno utworzyć nowe zgłoszenie ' +
              '(HTTP 201) i zwrócić reprezentację zasobu z polem externalId, serviceId oraz statusem.',
          );

          const externalId = `TC-001-${user}-${serviceId}-${randomUUID()}`;

          const response = await test.step('POST /troubleTicket z poprawnymi danymi', async () =>
            createTicket(request, user, {
              externalId,
              serviceId,
              description: 'TC-001: Test tworzenia zgłoszenia',
              status: 'new',
            }),
          );

          await test.step('Weryfikacja statusu HTTP i struktury odpowiedzi', async () => {
            expect(response.status()).toBe(201);

            const body = await response.json();
            expect(body).toMatchObject({
              externalId,
              serviceId,
            });
            // Status 'rejected' jest traktowany jako bug i ma powodować fail testu.
            expect(['new', 'acknowledged']).toContain(body.status);
            expect(Array.isArray(body.notes)).toBe(true);
          });

          await test.step('Weryfikacja nagłówka Location', async () => {
            const location = response.headers()['location'];
            expect(location).toBeTruthy();
            expect(location).toContain(externalId);
          });
        },
      );
    }
  }


  test(
    'TC-010: Idempotencja - powtórny POST z tym samym externalId zwraca HTTP 200',
    async ({ request }) => {
      await feature('Tworzenie zgłoszeń');
      await story('Idempotencja');
      await severity('critical');
      await description(
        'Para (tenantId, externalId) musi być unikalna. Drugie żądanie z tym samym ' +
          'externalId (ten sam tenant) powinno zwrócić HTTP 200 z istniejącym zasobem ' +
          'zamiast tworzyć duplikat (HTTP 201).',
      );

      const externalId = `TC-010-${randomUUID()}`;
      const payload = {
        externalId,
        serviceId: 100002,
        description: 'TC-010: Test idempotencji',
        status: 'new',
      };

      const first = await test.step('Pierwsze żądanie POST - oczekiwane HTTP 201', async () => {
        const r = await createTicket(request, 'alpha', payload);
        expect(r.status()).toBe(201);
        return r;
      });

      const second = await test.step('Drugie żądanie POST z tym samym externalId - oczekiwane HTTP 200', async () => {
        const r = await createTicket(request, 'alpha', payload);
        expect(r.status()).toBe(200);
        return r;
      });

      await test.step('Oba żądania zwracają ten sam zasób', async () => {
        const firstBody = await first.json();
        const secondBody = await second.json();
        expect(secondBody.externalId).toBe(firstBody.externalId);
        expect(secondBody.serviceId).toBe(firstBody.serviceId);
        expect(secondBody.status).toBe(firstBody.status);
      });

      await test.step('Weryfikacja w bazie danych - tylko jeden rekord', async () => {
        const count = await db.countTicketsByTenantAndExternalId('alpha', externalId);
        expect(count).toBe(1);
      });
    },
  );

  test(
  'TC-011: Idempotencja jest ograniczona do tenantId - ten sam externalId dla beta tworzy nowy zasób',
  async ({ request }) => {
    await feature('Tworzenie zgłoszeń');
    await story('Idempotencja / Multi-tenant');
    await severity('critical');
    await description(
      'Idempotencja działa tylko w ramach pojedynczego tenantId. ' +
        'Ten sam externalId użyty przez innego tenanta (beta) powinien utworzyć nowy zasób ' +
        '(HTTP 201) zamiast zwracać istniejący zasób alpha.',
    );

    const externalId = `TC-011-${randomUUID()}`;

    const payload = {
      externalId,
      serviceId: 100002,
      description: 'TC-011: Multi-tenant idempotency test',
      status: 'new',
    };

    //  1. Tworzenie zasobu dla alpha
    await test.step(
      'POST jako alpha - oczekiwane HTTP 201',
      async () => {
        const r = await createTicket(request, 'alpha', payload);
        expect(r.status()).toBe(201);
        return r;
      },
    );

    //  2. Ten sam externalId dla beta - nowy zasób
    await test.step(
      'POST jako beta z tym samym externalId - oczekiwane HTTP 201',
      async () => {
        const r = await createTicket(request, 'beta', payload);
        expect(r.status()).toBe(201);
        return r;
      },
    );

    await test.step('Weryfikacja w bazie danych - dwa tickety z tym samym externalId i różnym tenantId', async () => {
      const rows = await db.findTicketsByExternalId(externalId);

      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.tenant_id).sort()).toEqual(['alpha', 'beta']);
      expect(rows.every((row) => row.external_id === externalId)).toBe(true);
    });
  },
);


  const outOfRangeServiceIds = [100000, 100031,200090,80000,1];
for (const outOfRangeServiceId of outOfRangeServiceIds) {
  test(
    `TC-012: serviceId poza zakresem 100001-100030: ${outOfRangeServiceId} zwraca błąd 4xx`,
    async ({ request }) => {
      await feature('Tworzenie zgłoszeń');
      await story('Walidacja serviceId');
      await severity('critical');
      await description(
        'serviceId spoza zakresu danych testowych (100001-100030) powinien zostać odrzucony błędem 4xx.',
      );
      
        await test.step(`POST z serviceId=${outOfRangeServiceId} (spoza zakresu)`, async () => {
          const response = await createTicket(request, 'alpha', {
            externalId: `TC-012-${outOfRangeServiceId}-${randomUUID()}`,
            serviceId: outOfRangeServiceId,
            description: 'TC-012: serviceId spoza zakresu',
            status: 'new',
          });

          expect(response.status()).toBeGreaterThanOrEqual(400);
          expect(response.status()).toBeLessThan(500);
        });
      
    },
  );
}

  test(
    'TC-006: Brak tokenu autoryzacyjnego zwraca HTTP 401',
    async ({ request }) => {
      await feature('Tworzenie zgłoszeń');
      await story('Bezpieczeństwo / autoryzacja');
      await severity('blocker');
      await description(
        'Żądanie bez nagłówka Authorization powinno być odrzucone z HTTP 401.',
      );

      const response = await test.step('POST bez nagłówka Authorization', async () =>
        request.post('http://localhost:8080/api/v1/troubleTicket', {
          data: {
            externalId: `TC-006-${randomUUID()}`,
            serviceId: 100002,
            description: 'TC-006: Test brak tokenu',
            status: 'new',
          },
        }),
      );

      await test.step('Weryfikacja statusu HTTP 401', async () => {
        expect(response.status()).toBe(401);
      });
    },
  );
});

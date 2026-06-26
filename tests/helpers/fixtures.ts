/**
 * Playwright fixtures – fabryki danych testowych.
 *
 * Rozszerza bazowy `test` o fixture'y tworzące świeże zgłoszenia przez API
 * przed każdym testem. Każdy test dostaje własne, izolowane dane.
 *
 * Dostępne fixture'y (wstrzykiwane jako parametry funkcji testowej):
 *  acknowledgedTicket  – świeże zgłoszenie tworzone przez API do ścieżek pozytywnych
 *  closedTicket        – świeże zgłoszenie acknowledged, automatycznie zamknięte przed testem
 *
 * Dla statusów niemożliwych do utworzenia przez API (inProgress, resolved)
 * używaj stałych z obiektu FIXTURES – tickety te są seedowane przez global-setup.ts.
 *
 * Użycie w pliku testowym:
 *   import { test, expect, FIXTURES } from '../helpers/fixtures';
 *
 *   test('mój test', async ({ request, acknowledgedTicket }) => {
 *     const resp = await request.patch(`${API}/troubleTicket/${acknowledgedTicket}`, ...);
 *   });
 */

import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { FIXTURE_IDS } from '../global-setup';
import { createTicket, closeTicket } from './ticket-api';

export { expect };

// Re-eksportuj znane ID fixture'ów (z global-setup.ts) dla wygody w testach
export const FIXTURES = FIXTURE_IDS;

/**
 * Tworzy zgłoszenie przez API i zwraca jego externalId.
 * Używane do tworzenia izolowanych danych per-test.
 */
async function createTicketViaApi(
  request: import('@playwright/test').APIRequestContext,
  serviceId: number,
): Promise<string> {
  const externalId = `TEST-${randomUUID()}`;
  const response = await createTicket(request, 'alpha', {
    externalId,
    serviceId,
    description: `Fixture test ticket - ${externalId}`,
    status: 'new',
  });
  if (response.status() > 299) {
    throw new Error(
      `Nie udało się utworzyć fixture ticket via API: HTTP ${response.status()}`,
    );
  }
  return externalId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Definicja fixture'ów
// ─────────────────────────────────────────────────────────────────────────────

interface TestFixtures {
  /** externalId świeżego zgłoszenia w statusie acknowledged */
  acknowledgedTicket: string;
  /** externalId świeżego zgłoszenia w statusie closed */
  closedTicket: string;
}

export const test = base.extend<TestFixtures>({
  /**
    * Tworzy świeże zgłoszenie do testów ścieżek pozytywnych.
   * Każde wywołanie generuje nowy unikalny externalId (UUID).
   */
  acknowledgedTicket: async ({ request }, use) => {
    const externalId = await createTicketViaApi(request, 100002);
    await use(externalId);
  },

  /**
   * Tworzy zgłoszenie acknowledged, a następnie je zamyka.
   * Po wykonaniu testu ticket jest w statusie closed.
   */
  closedTicket: async ({ request }, use) => {
    const externalId = await createTicketViaApi(request, 100002);

    const closeResponse = await closeTicket(request, 'alpha', externalId);
    if (closeResponse.status() !== 200) {
      throw new Error(
        `Fixture closedTicket: nie udało się zamknąć ticketu ${externalId}: HTTP ${closeResponse.status()}`,
      );
    }

    await use(externalId);
  },
});

/**
 * Extends the base `test` with fixtures that create fresh tickets via API
 * before each test. Every test gets its own isolated data.
 *
 * Available fixtures (injected as test function parameters):
 *  acknowledgedTicket  - fresh ticket created via API for positive paths
 *  closedTicket        - fresh acknowledged ticket, automatically closed before the test
 *
 * For statuses that cannot be created via API (inProgress, resolved),
 * use constants from FIXTURES - these tickets are seeded by global-setup.ts.
 */

import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { FIXTURE_IDS } from "../global-setup";
import { createTicket, closeTicket } from "./ticket-api";

export { expect };

// Re-export known fixture IDs (from global-setup.ts) for convenience in tests
export const FIXTURES = FIXTURE_IDS;

/**
 * Creates a ticket through the API and returns its externalId.
 * Used to create isolated per-test data.
 */
async function createTicketViaApi(
  request: import("@playwright/test").APIRequestContext,
  serviceId: number,
): Promise<string> {
  const externalId = `TEST-${randomUUID()}`;
  const response = await createTicket(request, "alpha", {
    externalId,
    serviceId,
    description: `Fixture test ticket - ${externalId}`,
    status: "new",
  });
  if (response.status() > 299) {
    throw new Error(
      `Nie udało się utworzyć fixture ticket via API: HTTP ${response.status()}`,
    );
  }
  return externalId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture definitions
// ─────────────────────────────────────────────────────────────────────────────

interface TestFixtures {
  /** externalId of a fresh ticket in acknowledged status */
  acknowledgedTicket: string;
  /** externalId of a fresh ticket in closed status */
  closedTicket: string;
}

export const test = base.extend<TestFixtures>({
  /**
   * Creates a fresh ticket for positive-path tests.
   * Each invocation generates a new unique externalId (UUID).
   */
  acknowledgedTicket: async ({ request }, use) => {
    const externalId = await createTicketViaApi(request, 100002);
    await use(externalId);
  },

  /**
   * Creates an acknowledged ticket and then closes it.
   * After setup, the ticket is in closed status.
   */
  closedTicket: async ({ request }, use) => {
    const externalId = await createTicketViaApi(request, 100002);

    const closeResponse = await closeTicket(request, "alpha", externalId);
    if (closeResponse.status() !== 200) {
      throw new Error(
        `Fixture closedTicket: nie udało się zamknąć ticketu ${externalId}: HTTP ${closeResponse.status()}`,
      );
    }

    await use(externalId);
  },
});

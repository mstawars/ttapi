/**
 * Global setup - runs once before all tests.
 *
 * Creates dedicated fixture tickets in statuses that CANNOT be set
 * through the public API (inProgress, resolved). Each test that needs a given
 * status gets its own isolated resource.
 *
 * Fixture tickets:
 *  FIXTURE-CLOSE-INPROGRESS  -> used by api/close-ticket TC-021 (gets closed)
 *  FIXTURE-NOTE-INPROGRESS   -> used by api/add-note TC-032 (note added, stays inProgress)
 *  FIXTURE-REJECTED          -> used by close TC-023 + note TC-035 (400 errors)
 *  FIXTURE-RESOLVED          -> used by close TC-024 + note TC-034 (400 errors, no state change)
 *  FIXTURE-E2E-INPROGRESS    -> used by e2e/ticket-journey (note + close)
 *
 * Mechanism:
 *  Connects directly to PostgreSQL via the shared `dbConnection` helper.
 *  This way seeding and later DB assertions can use the same configuration.
 */

import type { FullConfig } from "@playwright/test";
import { createDbConnection } from "./helpers/dbConnection";

/** Fixture IDs - must stay in sync with FIXTURES in helpers/fixtures.ts */
export const FIXTURE_IDS = {
  CLOSE_INPROGRESS: "FIXTURE-CLOSE-INPROGRESS",
  NOTE_INPROGRESS: "FIXTURE-NOTE-INPROGRESS",
  REJECTED: "FIXTURE-REJECTED",
  RESOLVED: "FIXTURE-RESOLVED",
  E2E_INPROGRESS: "FIXTURE-E2E-INPROGRESS",
} as const;

type FixtureSeed = {
  tenantId: string;
  externalId: string;
  serviceId: number;
  description: string;
  status: string;
};

const FIXTURE_SEEDS: FixtureSeed[] = [
  {
    tenantId: "alpha",
    externalId: FIXTURE_IDS.CLOSE_INPROGRESS,
    serviceId: 100007,
    description: "Fixture: close-ticket TC-021 - zamkniecie z inProgress",
    status: "inProgress",
  },
  {
    tenantId: "alpha",
    externalId: FIXTURE_IDS.NOTE_INPROGRESS,
    serviceId: 100007,
    description: "Fixture: add-note TC-032 - notatka do inProgress",
    status: "inProgress",
  },
  {
    tenantId: "alpha",
    externalId: FIXTURE_IDS.REJECTED,
    serviceId: 100007,
    description:
      "Fixture: close TC-023 + note TC-035 - status rejected (testy negatywne)",
    status: "rejected",
  },
  {
    tenantId: "alpha",
    externalId: FIXTURE_IDS.RESOLVED,
    serviceId: 100008,
    description:
      "Fixture: close TC-024 + note TC-034 - status resolved (testy negatywne)",
    status: "resolved",
  },
  {
    tenantId: "alpha",
    externalId: FIXTURE_IDS.E2E_INPROGRESS,
    serviceId: 100007,
    description: "Fixture: E2E journey - notatka i zamkniecie z inProgress",
    status: "inProgress",
  },
];

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const db = createDbConnection();

  try {
    await db.query(
      "DELETE FROM public.trouble_ticket WHERE tenant_id = $1 AND external_id LIKE $2",
      ["alpha", "FIXTURE-%"],
    );

    for (const seed of FIXTURE_SEEDS) {
      await db.query(
        `INSERT INTO public.trouble_ticket
          (tenant_id, external_id, service_id, description, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          seed.tenantId,
          seed.externalId,
          seed.serviceId,
          seed.description,
          seed.status,
        ],
      );
    }

    console.log("\n✓ Fixture tickets seeded (FIXTURE-*)");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Nie udało się zaseedować fixture data.\n` +
        `Sprawdź czy baza danych jest osiągalna i czy ustawione są poprawne zmienne DB_*.\n` +
        `Szczegóły: ${message}`,
    );
  } finally {
    await db.close();
  }
}

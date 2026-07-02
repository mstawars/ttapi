/**
 * API tests - Create Ticket
 *
 * Endpoints: POST /api/v1/troubleTicket
 *
 * Scenarios:
 *  TC-001 - Valid data (different serviceId values) -> HTTP 201 + full resource representation
 *  TC-010 - Idempotency: repeated POST with same externalId -> HTTP 200
 *  TC-012 - serviceId outside 100001-100030 -> 4xx error
 *  TC-006 - Missing token -> HTTP 401
 *
 * Test data:
 *  - valid serviceId in test environment: 100001-100030 (according to TASK.md)
 *  - serviceId tested parametrically for multiple values
 *  - unique externalId generated with randomUUID to avoid collisions with seed data
 */

import { test, expect } from "@playwright/test";
import {
  feature,
  story,
  description,
  severity,
  attachment,
} from "allure-js-commons";
import { randomUUID } from "node:crypto";
import { createTicket } from "../helpers/ticket-api";
import { createDbConnection } from "../helpers/dbConnection";
import { attachApiResponse } from "../helpers/api-response";
import { getApiV1BaseUrl } from "../helpers/test-env";

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Tworzenie zgłoszenia - POST /api/v1/troubleTicket", () => {
  const db = createDbConnection();
  const users = ["alpha", "beta", "gamma"];
  const serviceIds = [100001, 100002, 100015, 100030];

  test.afterAll(async () => {
    await db.close();
  });

  for (const user of users) {
    for (const serviceId of serviceIds) {
      test(`TC-001: Poprawne dane zwracają HTTP 201 [user=${user}, serviceId=${serviceId}]`, async ({
        request,
      }) => {
        await feature("Tworzenie zgłoszeń");
        await story("Ścieżka pozytywna");
        await severity("critical");
        await description(
          "Wysłanie poprawnego payloadu z unikalnym externalId powinno utworzyć nowe zgłoszenie " +
            "(HTTP 201) i zwrócić reprezentację zasobu z polem externalId, serviceId oraz statusem.",
        );

        const externalId = `TC-001-${user}-${serviceId}-${randomUUID()}`;

        const response =
          await test.step("POST /troubleTicket z poprawnymi danymi", async () =>
            createTicket(request, user, {
              externalId,
              serviceId,
              description: "TC-001: Test tworzenia zgłoszenia",
              status: "new",
            }));

        await test.step("Weryfikacja statusu HTTP i struktury odpowiedzi", async () => {
          expect(
            response.status(),
            "POST nowego ticketu z poprawnymi danymi powinien zwrócić HTTP 201",
          ).toBe(201);

          const body = await attachApiResponse<{
            externalId: string;
            serviceId: number;
            status: string;
            notes?: unknown[];
          }>(`API Response (TC-001 [${user}/${serviceId}])`, response);
          expect(
            body,
            "Odpowiedź powinna zawierać externalId i serviceId",
          ).toMatchObject({
            externalId,
            serviceId,
          });
          // 'rejected' status is treated as a bug and should fail the test.
          expect(
            ["new", "acknowledged"],
            "Nowy ticket powinien mieć status new lub acknowledged",
          ).toContain(body.status);
          expect(
            Array.isArray(body.notes),
            "Ticket powinien mieć pole notes",
          ).toBe(true);
        });

        await test.step("Weryfikacja nagłówka Location", async () => {
          const location = response.headers()["location"];
          expect(location).toBeTruthy();
          expect(location).toContain(externalId);
        });
      });
    }
  }

  test("TC-010: Idempotencja - powtórny POST z tym samym externalId zwraca HTTP 200", async ({
    request,
  }) => {
    await feature("Tworzenie zgłoszeń");
    await story("Idempotencja");
    await severity("critical");
    await description(
      "Para (tenantId, externalId) musi być unikalna. Drugie żądanie z tym samym " +
        "externalId (ten sam tenant) powinno zwrócić HTTP 200 z istniejącym zasobem " +
        "zamiast tworzyć duplikat (HTTP 201).",
    );

    const externalId = `TC-010-${randomUUID()}`;
    const payload = {
      externalId,
      serviceId: 100002,
      description: "TC-010: Test idempotencji",
      status: "new",
    };

    const first =
      await test.step("Pierwsze żądanie POST - oczekiwane HTTP 201", async () => {
        const r = await createTicket(request, "alpha", payload);
        expect(
          r.status(),
          "Pierwsze żądanie POST powinno zwrócić HTTP 201",
        ).toBe(201);
        return r;
      });

    const second =
      await test.step("Drugie żądanie POST z tym samym externalId - oczekiwane HTTP 200", async () => {
        const r = await createTicket(request, "alpha", payload);
        expect(
          r.status(),
          "Drugie żądanie POST z tym samym externalId powinno zwrócić HTTP 200 (idempotencja)",
        ).toBe(200);
        return r;
      });

    await test.step("Oba żądania zwracają ten sam zasób", async () => {
      const firstBody = await first.json();
      const secondBody = await second.json();
      await attachment(
        "API Response (TC-010 - first POST)",
        JSON.stringify({ status: 201, body: firstBody }, null, 2),
        "application/json",
      );
      await attachment(
        "API Response (TC-010 - second POST)",
        JSON.stringify({ status: 200, body: secondBody }, null, 2),
        "application/json",
      );
      expect(
        secondBody.externalId,
        "Obie odpowiedzi powinny zawierać ten sam externalId",
      ).toBe(firstBody.externalId);
      expect(
        secondBody.serviceId,
        "Obie odpowiedzi powinny zawierać ten sam serviceId",
      ).toBe(firstBody.serviceId);
      expect(
        secondBody.status,
        "Obie odpowiedzi powinny zwrócić ten sam status",
      ).toBe(firstBody.status);
    });

    await test.step("Weryfikacja w bazie danych - tylko jeden rekord", async () => {
      const count = await db.countTicketsByTenantAndExternalId(
        "alpha",
        externalId,
      );
      expect(count).toBe(1);
    });
  });

  test("TC-011: Idempotencja jest ograniczona do tenantId - ten sam externalId dla beta tworzy nowy zasób", async ({
    request,
  }) => {
    await feature("Tworzenie zgłoszeń");
    await story("Idempotencja / Multi-tenant");
    await severity("critical");
    await description(
      "Idempotencja działa tylko w ramach pojedynczego tenantId. " +
        "Ten sam externalId użyty przez innego tenanta (beta) powinien utworzyć nowy zasób " +
        "(HTTP 201) zamiast zwracać istniejący zasób alpha.",
    );

    const externalId = `TC-011-${randomUUID()}`;

    const payload = {
      externalId,
      serviceId: 100002,
      description: "TC-011: Multi-tenant idempotency test",
      status: "new",
    };

    await test.step("POST jako alpha - oczekiwane HTTP 201", async () => {
      const response = await createTicket(request, "alpha", payload);
      expect(
        response.status(),
        "Pierwsza próba POST dla alpha powinna zwrócić HTTP 201",
      ).toBe(201);
      await attachApiResponse("API Response (TC-011 - alpha POST)", response);
    });

    await test.step("POST jako beta z tym samym externalId - oczekiwane HTTP 201", async () => {
      const response = await createTicket(request, "beta", payload);
      expect(
        response.status(),
        "Druga próba POST dla beta z tym samym externalId powinna zwrócić HTTP 201 (multi-tenant)",
      ).toBe(201);
      await attachApiResponse("API Response (TC-011 - beta POST)", response);
    });

    await test.step("Weryfikacja w bazie danych - dwa tickety z tym samym externalId i różnym tenantId", async () => {
      const rows = await db.findTicketsByExternalId(externalId);

      expect(rows, "Powinno być 2 tickety z tym samym externalId").toHaveLength(
        2,
      );
      expect(
        rows.map((row) => row.tenant_id).sort(),
        "Tickety powinny należeć do alpha i beta",
      ).toEqual(["alpha", "beta"]);
      expect(
        rows.every((row) => row.external_id === externalId),
        "Wszystkie tickety powinny mieć ten sam externalId",
      ).toBe(true);
    });
  });

  const outOfRangeServiceIds = [100000, 100031, 200090, 80000, 1];
  for (const outOfRangeServiceId of outOfRangeServiceIds) {
    test(`TC-012: serviceId poza zakresem 100001-100030: ${outOfRangeServiceId} zwraca błąd 4xx`, async ({
      request,
    }) => {
      await feature("Tworzenie zgłoszeń");
      await story("Walidacja serviceId");
      await severity("critical");
      await description(
        "serviceId spoza zakresu danych testowych (100001-100030) powinien zostać odrzucony błędem 4xx.",
      );

      await test.step(`POST z serviceId=${outOfRangeServiceId} (spoza zakresu)`, async () => {
        const response = await createTicket(request, "alpha", {
          externalId: `TC-012-${outOfRangeServiceId}-${randomUUID()}`,
          serviceId: outOfRangeServiceId,
          description: "TC-012: serviceId spoza zakresu",
          status: "new",
        });

        expect(
          response.status(),
          `POST z serviceId=${outOfRangeServiceId} powinno zwrócić HTTP 4xx`,
        ).toBeGreaterThanOrEqual(400);
        expect(response.status(), "Status nie powinien być 5xx").toBeLessThan(
          500,
        );

        await attachApiResponse(
          `API Response (TC-012 [${outOfRangeServiceId}])`,
          response,
        );
      });
    });
  }

  const invalidCreateStatuses = [
    "acknowledged",
    "inProgress",
    "resolved",
    "rejected",
    "closed",
  ];
  for (const invalidStatus of invalidCreateStatuses) {
    test(`TC-013: status='${invalidStatus}' przy tworzeniu ticketu zwraca VALIDATION_ERROR`, async ({
      request,
    }) => {
      await feature("Tworzenie zgłoszeń");
      await story("Walidacja statusu przy tworzeniu");
      await severity("critical");
      await description(
        "Przy tworzeniu ticketu klient nie powinien móc ustawić statusu innego niż dozwolony. " +
          "API powinno zwrócić błąd walidacji VALIDATION_ERROR.",
      );

      const response =
        await test.step(`POST /troubleTicket ze statusem '${invalidStatus}'`, async () =>
          createTicket(request, "alpha", {
            externalId: `TC-013-${invalidStatus}-${randomUUID()}`,
            serviceId: 100002,
            description: "TC-013: niepoprawny status przy tworzeniu",
            status: invalidStatus,
          }));

      await test.step("Weryfikacja HTTP 4xx i kodu VALIDATION_ERROR", async () => {
        expect(
          response.status(),
          `POST ze statusem '${invalidStatus}' powinno zwrócić HTTP 4xx`,
        ).toBeGreaterThanOrEqual(400);
        expect(response.status(), "Status nie powinien być 5xx").toBeLessThan(
          500,
        );

        const body = await attachApiResponse<{ code: string }>(
          `API Response (TC-013 [${invalidStatus}])`,
          response,
        );
        expect(
          body.code,
          `Kod błędu dla statusu '${invalidStatus}' powinien być VALIDATION_ERROR`,
        ).toBe("VALIDATION_ERROR");
      });
    });
  }

  test("TC-006: Brak tokenu autoryzacyjnego zwraca HTTP 401", async ({
    request,
  }) => {
    await feature("Tworzenie zgłoszeń");
    await story("Bezpieczeństwo / autoryzacja");
    await severity("blocker");
    await description(
      "Żądanie bez nagłówka Authorization powinno być odrzucone z HTTP 401.",
    );

    const response =
      await test.step("POST bez nagłówka Authorization", async () =>
        request.post(`${getApiV1BaseUrl()}/troubleTicket`, {
          data: {
            externalId: `TC-006-${randomUUID()}`,
            serviceId: 100002,
            description: "TC-006: Test brak tokenu",
            status: "new",
          },
        }));

    await test.step("Weryfikacja statusu HTTP 401", async () => {
      expect(
        response.status(),
        "Żądanie bez tokenu powinno zwrócić HTTP 401",
      ).toBe(401);
      await attachApiResponse("API Response (TC-006)", response);
    });
  });
});

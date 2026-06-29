/**
 * API tests – Dodawanie notatki (Add Note)
 *
 * Endpoint: POST /api/v1/troubleTicket/{id}/note   body: { "text": "..." }
 *
 * Reguła biznesowa:
 *  Notatki można dodawać do zgłoszeń w statusach: new, acknowledged, inProgress.
 *  Dodanie notatki do zgłoszenia w statusie resolved, closed lub rejected
 *  zwraca HTTP 400 z kodem NOTE_ADDITION_NOT_ALLOWED.
 *
 * Scenariusze:
 *  TC-031 – Notatka do acknowledged  → HTTP 201 + treść notatki
 *  TC-032 – Notatka do inProgress    → HTTP 201 + treść notatki
 *  TC-033 – Notatka do closed        → HTTP 400, NOTE_ADDITION_NOT_ALLOWED
 *  TC-034 – Notatka do resolved      → HTTP 400, NOTE_ADDITION_NOT_ALLOWED
 *  TC-035 – Notatka do rejected      → HTTP 400, NOTE_ADDITION_NOT_ALLOWED
 *
 * Izolacja danych:
 *  TC-031: fixture 'acknowledgedTicket'      – nowy ticket tworzony przez API przed każdym testem
 *  TC-032: FIXTURES.NOTE_INPROGRESS           – seedowany przez global-setup.ts, dedykowany
 *  TC-033: fixture 'closedTicket'             – nowy acknowledged ticket, zamknięty przed testem
 *  TC-034: FIXTURES.RESOLVED                  – seedowany przez global-setup.ts (błąd 400, brak zmiany statusu)
 *  TC-035: FIXTURES.REJECTED                  – seedowany przez global-setup.ts (wyłącznie test 400)
 *
 * Każdy test korzysta z własnych, izolowanych danych.
 * global-setup.ts resetuje FIXTURE-* tickety przed każdym uruchomieniem.
 */

import { test, expect, FIXTURES } from '../helpers/fixtures';
import { feature, story, description, severity, attachment } from "allure-js-commons";
import { randomUUID } from 'node:crypto';
import { addNote } from '../helpers/ticket-api';
import { attachApiResponse } from '../helpers/api-response';

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Dodawanie notatki – POST /api/v1/troubleTicket/{id}/note', () => {
  test(
    'TC-031: Dodanie notatki do zgłoszenia acknowledged → HTTP 201',
    async ({ request, acknowledgedTicket }) => {
      await feature('Notatki');
      await story('Ścieżka pozytywna');
      await severity('high');
      await description(
        'Notatka dodana do zgłoszenia w statusie acknowledged powinna zakończyć się ' +
          'HTTP 201 i zwrócić obiekt notatki z polem text.',
      );

      const noteText = `TC-031 notatka ${randomUUID()}`;

      const response = await test.step(
        `POST /troubleTicket/${acknowledgedTicket}/note`,
        async () => addNote(request, 'alpha', acknowledgedTicket, noteText),
      );

      await test.step('Weryfikacja HTTP 201 i treści notatki', async () => {
        expect(response.status(), 'Dodanie notatki do acknowledged ticketu powinno zwrocic HTTP 201').toBe(201);
        const body = await attachApiResponse<{ text: string; id: string; date: string }>('API Response (TC-031)', response);
        expect(body.text, 'Odpowiedz po dodaniu notatki powinna zawierac przeslany tekst notatki').toBe(noteText);
        expect(typeof body.id, 'Dodana notatka powinna miec identyfikator typu string').toBe('string');
        expect(typeof body.date, 'Dodana notatka powinna miec date typu string').toBe('string');
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────

  test(
    `TC-032: Dodanie notatki do zgłoszenia inProgress → HTTP 201 [fixture: ${FIXTURES.NOTE_INPROGRESS}]`,
    async ({ request }) => {
      await feature('Notatki');
      await story('Ścieżka pozytywna');
      await severity('high');
      await description(
        'Notatka dodana do zgłoszenia w statusie inProgress powinna zakończyć się ' +
          `HTTP 201. Używa dedykowanego fixture \'${FIXTURES.NOTE_INPROGRESS}\' ` +
          'seedowanego przez global-setup.ts. Dodanie notatki NIE zmienia statusu zgłoszenia.',
      );

      const noteText = `TC-032 notatka ${randomUUID()}`;

      const response = await test.step(
        `POST /troubleTicket/${FIXTURES.NOTE_INPROGRESS}/note`,
        async () => addNote(request, 'alpha', FIXTURES.NOTE_INPROGRESS, noteText),
      );

      await test.step('Weryfikacja HTTP 201 i treści notatki', async () => {
        expect(response.status(), 'Dodanie notatki do inProgress ticketu powinno zwrocic HTTP 201').toBe(201);
        const body = await attachApiResponse<{ text: string }>('API Response (TC-032)', response);
        expect(body.text, 'Odpowiedz po dodaniu notatki do inProgress ticketu powinna zawierac przeslany tekst').toBe(noteText);
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────

  test(
    'TC-033: Dodanie notatki do zgłoszenia closed → HTTP 400, NOTE_ADDITION_NOT_ALLOWED',
    async ({ request, closedTicket }) => {
      await feature('Notatki');
      await story('Ścieżka negatywna');
      await severity('critical');
      await description(
        'Próba dodania notatki do zgłoszenia w statusie closed powinna zwrócić ' +
          'HTTP 400 z kodem NOTE_ADDITION_NOT_ALLOWED. ' +
          "Fixture 'closedTicket' dostarcza świeży zamknięty ticket.",
      );

      const response = await test.step(
        `POST /troubleTicket/${closedTicket}/note (ticket closed)`,
        async () => addNote(request, 'alpha', closedTicket, 'TC-033: próba notatki do zamkniętego zgłoszenia'),
      );

      await test.step('Weryfikacja błędu HTTP 400 i kodu NOTE_ADDITION_NOT_ALLOWED', async () => {
        expect(response.status(), 'Dodanie notatki do closed ticketu powinno zwrocic HTTP 400').toBe(400);
        const body = await attachApiResponse<{ code: string }>('API Response (TC-033)', response);
        expect(body.code, 'Kod bledu dla notatki dodawanej do closed ticketu powinien byc NOTE_ADDITION_NOT_ALLOWED').toBe('NOTE_ADDITION_NOT_ALLOWED');
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────

  test(
    `TC-034: Dodanie notatki do zgłoszenia resolved → HTTP 400, NOTE_ADDITION_NOT_ALLOWED [fixture: ${FIXTURES.RESOLVED}]`,
    async ({ request }) => {
      await feature('Notatki');
      await story('Ścieżka negatywna');
      await severity('critical');
      await description(
        'Próba dodania notatki do zgłoszenia w statusie resolved powinna zwrócić ' +
          `HTTP 400 z kodem NOTE_ADDITION_NOT_ALLOWED. Używa fixture \'${FIXTURES.RESOLVED}\' ` +
          '– operacja 400 nie zmienia statusu ticketu, bezpieczne dla wielokrotnych uruchomień.',
      );

      const response = await test.step(
        `POST /troubleTicket/${FIXTURES.RESOLVED}/note (ticket resolved)`,
        async () => addNote(request, 'alpha', FIXTURES.RESOLVED, 'TC-034: próba notatki do resolved zgłoszenia'),
      );

      await test.step('Weryfikacja błędu HTTP 400 i kodu NOTE_ADDITION_NOT_ALLOWED', async () => {
        expect(response.status(), 'Dodanie notatki do resolved ticketu powinna zwrocic HTTP 400').toBe(400);
        const body = await attachApiResponse<{ code: string }>('API Response (TC-034)', response);
        expect(body.code, 'Kod bledu dla notatki do resolved powinna byc NOTE_ADDITION_NOT_ALLOWED').toBe('NOTE_ADDITION_NOT_ALLOWED');
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────

  test(
    'TC-035: Dodanie notatki do zgłoszenia rejected → HTTP 400, NOTE_ADDITION_NOT_ALLOWED',
    async ({ request }) => {
      await feature('Notatki');
      await story('Ścieżka negatywna');
      await severity('critical');
      await description(
        'Próba dodania notatki do zgłoszenia w statusie rejected powinna zwrócić ' +
          'HTTP 400 z kodem NOTE_ADDITION_NOT_ALLOWED.',
      );

      const response = await test.step(
        `POST /troubleTicket/${FIXTURES.REJECTED}/note (ticket rejected)`,
        async () => addNote(request, 'alpha', FIXTURES.REJECTED, 'TC-035: próba notatki do odrzuconego zgłoszenia'),
      );

      await test.step('Weryfikacja błędu HTTP 400 i kodu NOTE_ADDITION_NOT_ALLOWED', async () => {
        expect(response.status(), 'Dodanie notatki do rejected ticketu powinna zwrocic HTTP 400').toBe(400);
        const body = await attachApiResponse<{ code: string }>('API Response (TC-035)', response);
        expect(body.code, 'Kod bledu dla notatki do rejected powinna byc NOTE_ADDITION_NOT_ALLOWED').toBe('NOTE_ADDITION_NOT_ALLOWED');
      });
    },
  );

  test(
    'TC-045: Tenant beta nie może dodać notatki do zgłoszenia tenant alpha → HTTP 404',
    async ({ request, acknowledgedTicket }) => {
      await feature('Notatki');
      await story('Izolacja tenantów');
      await severity('critical');
      await description(
        'Tenant beta nie może dodać notatki do zgłoszenia należącego do tenant alpha. ' +
          'API powinno zwrócić HTTP 404 oraz kod TROUBLE_TICKET_NOT_FOUND.',
      );

      const response = await test.step(
        `POST /troubleTicket/${acknowledgedTicket}/note jako beta`,
        async () => addNote(request, 'beta', acknowledgedTicket, 'TC-045: cross-tenant note attempt'),
      );

      await test.step('Weryfikacja HTTP 404 i kodu TROUBLE_TICKET_NOT_FOUND', async () => {
        expect(response.status(), 'Tenant beta nie moze dodac notatki do ticketu alpha, spodziewamy sie HTTP 404').toBe(404);
        const body = await attachApiResponse<{ code: string }>('API Response (TC-045)', response);
        expect(body.code, 'Kod bledu dla cross-tenant note powinien byc TROUBLE_TICKET_NOT_FOUND').toBe('TROUBLE_TICKET_NOT_FOUND');
      });
    },
  );
});

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
import { feature, story, description, severity } from "allure-js-commons";
import { randomUUID } from 'node:crypto';
import { addNote } from '../helpers/ticket-api';

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
        expect(response.status()).toBe(201);
        const body = await response.json();
        expect(body.text).toBe(noteText);
        expect(typeof body.id).toBe('string');
        expect(typeof body.date).toBe('string');
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
        expect(response.status()).toBe(201);
        const body = await response.json();
        expect(body.text).toBe(noteText);
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
        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.code).toBe('NOTE_ADDITION_NOT_ALLOWED');
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
        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.code).toBe('NOTE_ADDITION_NOT_ALLOWED');
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
        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.code).toBe('NOTE_ADDITION_NOT_ALLOWED');
      });
    },
  );
});

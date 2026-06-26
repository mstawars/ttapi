/**
 * Metody pomocnicze do komunikacji z API zgłoszeń.
 *
 * Każda funkcja opakowuje jeden request HTTP, przyjmując jako argument
 * kontekst requestu Playwright, tenanta oraz payload. Zwracają surową
 * odpowiedź APIResponse – asercje pozostają w testach.
 *
 * Użycie:
 *   import { createTicket, closeTicket, addNote } from '../helpers/ticket-api';
 *
 *   const response = await createTicket(request, 'alpha', { externalId, serviceId, description });
 *   expect(response.status()).toBe(201);
 */

import type { APIRequestContext, APIResponse } from '@playwright/test';
import { bearerHeader } from './auth';

const API = 'http://localhost:8080/api/v1';

export interface CreateTicketPayload {
  externalId: string;
  serviceId: number;
  description: string;
  status?: string;
}

/**
 * POST /api/v1/troubleTicket
 *
 * Tworzy nowe zgłoszenie dla podanego tenanta.
 */
export async function createTicket(
  request: APIRequestContext,
  tenant: string,
  payload: CreateTicketPayload,
): Promise<APIResponse> {
  return request.post(`${API}/troubleTicket`, {
    headers: await bearerHeader(tenant),
    data: payload,
  });
}

/**
 * GET /api/v1/troubleTicket/{externalId}
 *
 * Pobiera szczegóły zgłoszenia o podanym externalId w kontekście podanego tenanta.
 */
export async function getTicket(
  request: APIRequestContext,
  tenant: string,
  externalId: string,
): Promise<APIResponse> {
  return request.get(`${API}/troubleTicket/${externalId}`, {
    headers: await bearerHeader(tenant),
  });
}

/**
 * GET /api/v1/troubleTicket
 *
 * Zwraca listę zgłoszeń widocznych dla podanego tenanta.
 */
export async function listTickets(
  request: APIRequestContext,
  tenant: string,
): Promise<APIResponse> {
  return request.get(`${API}/troubleTicket`, {
    headers: await bearerHeader(tenant),
  });
}

/**
 * PATCH /api/v1/troubleTicket/{externalId}   body: { status: 'closed' }
 *
 * Zamyka zgłoszenie o podanym externalId w kontekście podanego tenanta.
 */
export async function closeTicket(
  request: APIRequestContext,
  tenant: string,
  externalId: string,
  status: string = 'closed',
): Promise<APIResponse> {
  return request.patch(`${API}/troubleTicket/${externalId}`, {
    headers: await bearerHeader(tenant),
    data: { status },
  });
}

/**
 * POST /api/v1/troubleTicket/{externalId}/note   body: { text }
 *
 * Dodaje notatkę do zgłoszenia o podanym externalId w kontekście podanego tenanta.
 */
export async function addNote(
  request: APIRequestContext,
  tenant: string,
  externalId: string,
  text: string,
): Promise<APIResponse> {
  return request.post(`${API}/troubleTicket/${externalId}/note`, {
    headers: await bearerHeader(tenant),
    data: { text },
  });
}

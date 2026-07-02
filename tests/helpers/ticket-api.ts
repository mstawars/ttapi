/**
 * Helper methods for communication with the ticket API.
 *
 * Each function wraps a single HTTP request, taking the Playwright request
 * context, tenant, and payload as input. They return the raw APIResponse -
 * assertions stay in tests.
 *
 * Usage:
 *   import { createTicket, closeTicket, addNote } from '../helpers/ticket-api';
 *
 *   const response = await createTicket(request, 'alpha', { externalId, serviceId, description });
 *   expect(response.status()).toBe(201);
 */

import type { APIRequestContext, APIResponse } from "@playwright/test";
import { bearerHeader } from "./auth";
import { getApiV1BaseUrl } from "./test-env";

const API = getApiV1BaseUrl();

export interface CreateTicketPayload {
  externalId: string;
  serviceId: number;
  description: string;
  status?: string;
}

/**
 * POST /api/v1/troubleTicket
 *
 * Creates a new ticket for the given tenant.
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
 * Retrieves ticket details for the provided externalId in the given tenant context.
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
 * Returns a list of tickets visible to the given tenant.
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
 * Closes the ticket with the given externalId in the given tenant context.
 */
export async function closeTicket(
  request: APIRequestContext,
  tenant: string,
  externalId: string,
  status: string = "closed",
): Promise<APIResponse> {
  return request.patch(`${API}/troubleTicket/${externalId}`, {
    headers: await bearerHeader(tenant),
    data: { status },
  });
}

/**
 * POST /api/v1/troubleTicket/{externalId}/note   body: { text }
 *
 * Adds a note to the ticket with the given externalId in the given tenant context.
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

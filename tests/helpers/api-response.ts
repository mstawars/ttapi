import { type APIResponse } from '@playwright/test';
import { attachment } from 'allure-js-commons';

export async function attachApiResponse<T = unknown>(label: string, response: APIResponse): Promise<T> {
  const body = (await response.json()) as T;
  await attachment(label, JSON.stringify({ status: response.status(), body }, null, 2), 'application/json');
  return body;
}
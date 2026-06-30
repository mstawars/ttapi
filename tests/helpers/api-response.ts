import { type APIResponse } from '@playwright/test';
import { attachment } from 'allure-js-commons';

/**
 * Safely parse response body and attach to Allure report.
 * Handles responses without JSON body (e.g., 401 with empty body).
 *
 * @param label - Report label
 * @param response - Playwright API response
 * @returns Parsed JSON body, or empty object if body is not parseable
 */
export async function attachApiResponse<T = unknown>(label: string, response: APIResponse): Promise<T> {
  let body: T | undefined;

  try {
    const text = await response.text();
    if (text && text.trim().length > 0) {
      body = JSON.parse(text) as T;
    }
  } catch (err) {
    // Response does not contain valid JSON (e.g., 401 with empty body)
    // Silently treat as missing body
  }

  await attachment(
    label,
    JSON.stringify({ status: response.status(), body: body ?? {} }, null, 2),
    'application/json',
  );

  return body ?? ({} as T);
}
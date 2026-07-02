import { type APIResponse } from "@playwright/test";
import { attachment } from "allure-js-commons";

/**
 *
 *
 * @param label
 * @param response
 * @returns
 */
export async function attachApiResponse<T = unknown>(
  label: string,
  response: APIResponse,
): Promise<T> {
  let body: T | undefined;

  try {
    const text = await response.text();
    if (text && text.trim().length > 0) {
      body = JSON.parse(text) as T;
    }
  } catch {}

  await attachment(
    label,
    JSON.stringify({ status: response.status(), body: body ?? {} }, null, 2),
    "application/json",
  );

  return body ?? ({} as T);
}

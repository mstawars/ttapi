/**
 * Keycloak token provider for API tests.
 *
 * Fetches Bearer tokens using the Resource Owner Password Credentials (ROPC) flow.
 * Tokens are cached in memory and automatically refreshed before expiry.
 *
 * Environment:
 *   Configured through `tests/helpers/test-env.ts` so values can differ per environment.
 */
import { getKeycloakConfig } from './test-env';

const { baseUrl, realm, clientId, defaultPassword } = getKeycloakConfig();

const KC_TOKEN_URL = `${baseUrl}/realms/${realm}/protocol/openid-connect/token`;

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const cache = new Map<string, CachedToken>();

/**
 * Returns a valid Bearer token for the given Keycloak user.
 * Tokens are cached per username and refreshed 10 s before expiry.
 *
 * @param username - Keycloak username (e.g. 'alpha', 'beta', 'gamma')
 * @param password - Keycloak password (default: 'Test1234!')
 */
export async function getToken(
  username: string,
  password: string = defaultPassword,
): Promise<string> {
  const now = Date.now();
  const cached = cache.get(username);

  if (cached && cached.expiresAt > now + 10_000) {
    return cached.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    username,
    password,
  });

  const response = await fetch(KC_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Keycloak token request failed for user "${username}": HTTP ${response.status} – ${text}`,
    );
  }

  const data = (await response.json()) as TokenResponse;

  cache.set(username, {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1_000,
  });

  return data.access_token;
}

/**
 * Returns an Authorization header value for the given user.
 */
export async function bearerHeader(
  username: string,
  password?: string,
): Promise<{ Authorization: string }> {
  const token = await getToken(username, password);
  return { Authorization: `Bearer ${token}` };
}

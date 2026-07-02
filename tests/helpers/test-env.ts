import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

const envDir = path.resolve(__dirname, "..");
const appEnv = process.env.APP_ENV?.trim();
const envCandidates = appEnv ? [`.env.${appEnv}`, ".env"] : [".env"];

for (const fileName of envCandidates) {
  const envPath = path.join(envDir, fileName);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export interface KeycloakConfig {
  baseUrl: string;
  realm: string;
  clientId: string;
  defaultPassword: string;
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Brak wymaganej zmiennej środowiskowej ${name}`);
  }
  return value;
}

function getNormalizedUrl(name: string): string {
  return getEnv(name).trim().replace(/\/+$/, "");
}

function getEnvNumber(name: string): number {
  const raw = getEnv(name);

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Zmienna ${name} musi być liczbą, otrzymano: ${raw}`);
  }

  return parsed;
}

function getEnvBoolean(name: string): boolean {
  const raw = getEnv(name).toLowerCase();

  if (["1", "true", "yes", "on"].includes(raw)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(raw)) {
    return false;
  }

  throw new Error(
    `Zmienna ${name} musi być wartością boolean (true/false/1/0/yes/no/on/off), otrzymano: ${raw}`,
  );
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: getEnv("DB_HOST"),
    port: getEnvNumber("DB_PORT"),
    user: getEnv("DB_USER"),
    password: getEnv("DB_PASSWORD"),
    database: getEnv("DB_NAME"),
    ssl: getEnvBoolean("DB_SSL"),
  };
}

export function getKeycloakConfig(): KeycloakConfig {
  return {
    baseUrl: getEnv("KC_BASE_URL"),
    realm: getEnv("KC_REALM"),
    clientId: getEnv("KC_CLIENT_ID"),
    defaultPassword: getEnv("KC_DEFAULT_PASSWORD"),
  };
}

export function getApiBaseUrl(): string {
  return getNormalizedUrl("API_BASE_URL");
}

export function getApiV1BaseUrl(): string {
  return `${getApiBaseUrl()}/api/v1`;
}

export function getFrontendUrl(): string {
  return getNormalizedUrl("FRONTEND_URL");
}

export interface TenantCredentials {
  username: string;
  password: string;
}

export function getTenantCredentials(tenantId: string): TenantCredentials {
  const supportedTenants = ["alpha", "beta", "gamma"];
  if (!supportedTenants.includes(tenantId)) {
    throw new Error(
      `Nieznany tenant: ${tenantId}. Dostępni: alpha, beta, gamma`,
    );
  }

  const tenantKey = tenantId.toUpperCase();
  return {
    username: getEnv(`TENANT_${tenantKey}_USERNAME`),
    password: getEnv(`TENANT_${tenantKey}_PASSWORD`),
  };
}

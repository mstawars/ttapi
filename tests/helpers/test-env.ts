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

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Brak wymaganej zmiennej środowiskowej ${name}`);
  }
  return value;
}

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Zmiennej ${name} musi być liczbą, otrzymano: ${raw}`);
  }

  return parsed;
}

function getEnvBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: getEnv('DB_HOST', 'localhost'),
    port: getEnvNumber('DB_PORT', 5432),
    user: getEnv('DB_USER', 'postgres'),
    password: getEnv('DB_PASSWORD', 'postgres'),
    database: getEnv('DB_NAME', 'rest_db'),
    ssl: getEnvBoolean('DB_SSL', false),
  };
}

export function getKeycloakConfig(): KeycloakConfig {
  return {
    baseUrl: getEnv('KC_BASE_URL', 'http://localhost:8180'),
    realm: getEnv('KC_REALM', 'ttapi'),
    clientId: getEnv('KC_CLIENT_ID', 'ttapi-client'),
    defaultPassword: getEnv('KC_DEFAULT_PASSWORD', 'Test1234!'),
  };
}

export interface TenantCredentials {
  username: string;
  password: string;
}

export function getTenantCredentials(tenantId: string): TenantCredentials {
  const supportedTenants = ['alpha', 'beta', 'gamma'];
  if (!supportedTenants.includes(tenantId)) {
    throw new Error(`Neznany tenant: ${tenantId}. Dostępni: alpha, beta, gamma`);
  }

  const tenantKey = tenantId.toUpperCase();
  const usernameEnv = process.env[`TENANT_${tenantKey}_USERNAME`];
  const passwordEnv = process.env[`TENANT_${tenantKey}_PASSWORD`];
  if (usernameEnv && passwordEnv) {
    return {
      username: usernameEnv,
      password: passwordEnv,
    };
  }

  // Final fallback for local defaults
  const defaultPassword = getKeycloakConfig().defaultPassword;
  return {
    username: tenantId,
    password: defaultPassword,
  };
}

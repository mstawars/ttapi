import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';
import { getDatabaseConfig } from './test-env';

export class DbConnection {
  private readonly pool: Pool;

  constructor(config: PoolConfig = toPoolConfig(getDatabaseConfig())) {
    this.pool = new Pool(config);
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] ?? null;
  }

  async countTicketsByExternalId(externalId: string): Promise<number> {
    const row = await this.queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM public.trouble_ticket WHERE external_id = $1',
      [externalId],
    );
    return Number(row?.count ?? 0);
  }

  async countTicketsByTenantAndExternalId(
    tenantId: string,
    externalId: string,
  ): Promise<number> {
    const row = await this.queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM public.trouble_ticket WHERE tenant_id = $1 AND external_id = $2',
      [tenantId, externalId],
    );
    return Number(row?.count ?? 0);
  }

  async findTicketsByExternalId(
    externalId: string,
  ): Promise<Array<{ tenant_id: string; external_id: string; status: string; service_id: number }>> {
    const result = await this.query<{
      tenant_id: string;
      external_id: string;
      status: string;
      service_id: number;
    }>(
      'SELECT tenant_id, external_id, status, service_id FROM public.trouble_ticket WHERE external_id = $1 ORDER BY tenant_id',
      [externalId],
    );
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function toPoolConfig(config: ReturnType<typeof getDatabaseConfig>): PoolConfig {
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  };
}

export function createDbConnection(): DbConnection {
  return new DbConnection();
}

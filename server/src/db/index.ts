import fs from 'node:fs';
import pg from 'pg';
import { migrate } from './migrations.js';

export type Row = Record<string, any>;

export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  exec(sql: string): Promise<void>;
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: 'postgres' | 'embutido';
}

export interface DbOptions {
  url?: string;
  /** Diretório do banco embutido; omitido = em memória (testes). */
  dataDir?: string;
}

/** DATE volta como 'AAAA-MM-DD' e inteiros grandes como number, nos dois motores. */
export async function createDb(opts: DbOptions): Promise<Db> {
  const db = opts.url ? createPg(opts.url) : await createPglite(opts.dataDir);
  await migrate(db);
  return db;
}

function createPg(url: string): Db {
  pg.types.setTypeParser(1082, (v) => v);
  pg.types.setTypeParser(20, (v) => Number(v));
  pg.types.setTypeParser(1700, (v) => Number(v));
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const run = async <T>(c: pg.Pool | pg.PoolClient, sql: string, params?: unknown[]) =>
    (await c.query(sql, params as any[])).rows as T[];
  return {
    kind: 'postgres',
    query: (sql, params) => run(pool, sql, params),
    exec: async (sql) => { await pool.query(sql); },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn({ query: (sql, params) => run(client, sql, params) });
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function createPglite(dataDir?: string): Promise<Db> {
  const { PGlite, types } = await import('@electric-sql/pglite');
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const parsers = {
    [types.DATE]: (v: string) => v,
    [types.INT8]: (v: string) => Number(v),
    [types.NUMERIC]: (v: string) => Number(v),
  };
  const lite = new PGlite({ dataDir, parsers });
  await lite.waitReady;
  return {
    kind: 'embutido',
    query: async (sql, params) => (await lite.query(sql, params as any[])).rows as any[],
    exec: async (sql) => { await lite.exec(sql); },
    tx: (fn) => lite.transaction((t) => fn({ query: async (sql, params) => (await t.query(sql, params as any[])).rows as any[] })),
    close: () => lite.close(),
  };
}

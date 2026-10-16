import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 3000),
  /** PostgreSQL externo (Neon, Supabase, Render, RDS...). Vazio = banco embutido em DATA_DIR. */
  databaseUrl: process.env.DATABASE_URL || '',
  dataDir: process.env.DATA_DIR || path.resolve(process.cwd(), 'data'),
  sessionHours: Number(process.env.SESSION_HOURS || 12),
  secureCookies: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== '1',
  trustProxy: process.env.TRUST_PROXY !== '0',
  webDist: process.env.WEB_DIST || path.resolve(here, '../../web/dist'),
};

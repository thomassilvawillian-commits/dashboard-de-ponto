import { createApp } from './app.js';
import { config } from './config.js';
import { createDb } from './db/index.js';

const db = await createDb({ url: config.databaseUrl || undefined, dataDir: config.dataDir });
const app = createApp(db);
const server = app.listen(config.port, () => {
  console.log(`Controle de Ponto rodando em http://localhost:${config.port} (banco: ${db.kind === 'postgres' ? 'PostgreSQL' : 'embutido em ' + config.dataDir})`);
});

async function shutdown() {
  server.close();
  await db.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

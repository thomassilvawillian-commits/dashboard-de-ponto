/**
 * Modo programa de computador: usado pelo atalho "Abrir Controle de Ponto".
 * Guarda o banco na pasta "dados" ao lado do programa, abre o navegador e
 * impede duas cópias abertas ao mesmo tempo (o banco embutido aceita um único processo).
 */
import { exec } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.env.DATA_DIR ||= path.join(root, 'dados');
process.env.TRUST_PROXY ||= '0';
delete process.env.DATABASE_URL;
const FIRST_PORT = Number(process.env.PORT || 3000);

function openBrowser(url: string) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

async function runningAt(port: number) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    return (await r.json()).app === 'controle-de-ponto';
  } catch {
    return false;
  }
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((n): n is os.NetworkInterfaceInfo => !!n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

for (let port = FIRST_PORT; port < FIRST_PORT + 10; port++) {
  if (await runningAt(port)) {
    console.log('O Controle de Ponto já está aberto. Abrindo o navegador...');
    openBrowser(`http://localhost:${port}`);
    process.exit(0);
  }
}

const { createApp } = await import('./app.js');
const { createDb } = await import('./db/index.js');
const db = await createDb({ dataDir: process.env.DATA_DIR });
const app = createApp(db);

function listen(port: number): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0');
    server.once('listening', () => resolve({ port, close: () => server.close() }));
    server.once('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'EADDRINUSE' && port < FIRST_PORT + 10) resolve(listen(port + 1));
      else reject(e);
    });
  });
}

const { port, close } = await listen(FIRST_PORT);
const url = `http://localhost:${port}`;
console.log(`
  Controle de Ponto aberto em ${url}
  Dados guardados em: ${process.env.DATA_DIR}
${lanAddresses().map((ip) => `  Em outro aparelho na mesma rede (celular, outro PC): http://${ip}:${port}`).join('\n')}

  Mantenha esta janela aberta enquanto usar o sistema.
  Para encerrar, feche esta janela.
`);
openBrowser(url);

async function shutdown() {
  close();
  await db.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

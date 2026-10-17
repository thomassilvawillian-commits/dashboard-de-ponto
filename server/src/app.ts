import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { loadSession, requireRole } from './auth/session.js';
import { config } from './config.js';
import type { Db } from './db/index.js';
import { HttpError, errorHandler } from './http.js';
import { insightsRouter } from './routes/admin/insights.js';
import { opsRouter } from './routes/admin/ops.js';
import { usersRouter } from './routes/admin/users.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';

export function createApp(db: Db, opts: { webDist?: string | null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use((req: Request, res: Response, next: NextFunction) => {
    req.db = db;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    next();
  });

  const api = express.Router();
  api.use(express.json({ limit: '200kb' }));
  // Protege contra envio de formulários de outros sites: a API só aceita JSON.
  api.use((req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['content-length'] !== '0' && req.body !== undefined && !req.is('application/json')) {
      throw new HttpError(415, 'Envie os dados em JSON.');
    }
    next();
  });
  api.use(loadSession);
  api.get('/health', async (_req, res) => {
    await db.query('select 1');
    res.json({ ok: true, app: 'controle-de-ponto', database: db.kind });
  });
  api.use('/auth', authRouter);
  api.use('/me', meRouter);
  api.use('/admin', requireRole('ADMIN', 'GESTOR'), usersRouter, opsRouter, insightsRouter);
  api.use((_req, _res) => { throw new HttpError(404, 'Rota não encontrada.'); });
  api.use(errorHandler);
  app.use('/api', api);

  const dist = opts.webDist === undefined ? config.webDist : opts.webDist;
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h', setHeaders: (res, file) => {
      if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } }));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
  return app;
}

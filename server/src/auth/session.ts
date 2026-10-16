import type { NextFunction, Request, Response } from 'express';
import type { Db } from '../db/index.js';
import { config } from '../config.js';
import { HttpError, clientIp } from '../http.js';
import { randomToken, sha256 } from './password.js';

export const COOKIE = 'ponto_sessao';

export type Role = 'ADMIN' | 'GESTOR' | 'FUNCIONARIO';
export interface SessionUser {
  id: number;
  name: string;
  username: string;
  role: Role;
  mustChangePassword: boolean;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request { user?: SessionUser; db: Db }
  }
}

function readCookie(req: Request, name: string) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

export async function createSession(db: Db, req: Request, res: Response, userId: number) {
  const token = randomToken();
  const expires = new Date(Date.now() + config.sessionHours * 3600_000);
  await db.query('insert into sessions (id, user_id, expires_at, ip, user_agent) values ($1,$2,$3,$4,$5)',
    [sha256(token), userId, expires, clientIp(req), String(req.headers['user-agent'] || '').slice(0, 300)]);
  await db.query('delete from sessions where expires_at < now()');
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: config.secureCookies, expires, path: '/',
  });
}

export async function destroySession(db: Db, req: Request, res: Response) {
  const token = readCookie(req, COOKIE);
  if (token) await db.query('delete from sessions where id = $1', [sha256(token)]);
  res.clearCookie(COOKIE, { path: '/' });
}

/** Carrega o usuário da sessão, se houver. Não bloqueia a requisição. */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token = readCookie(req, COOKIE);
  if (!/^[a-f0-9]{64}$/.test(token)) return next();
  const id = sha256(token);
  const rows = await req.db.query(
    `select u.id, u.name, u.username, u.role, u.must_change_password, s.last_seen_at
       from sessions s join users u on u.id = s.user_id
      where s.id = $1 and s.expires_at > now() and u.active`, [id]);
  const row = rows[0];
  if (row) {
    req.user = { id: row.id, name: row.name, username: row.username, role: row.role, mustChangePassword: row.must_change_password, sessionId: id };
    if (Date.now() - new Date(row.last_seen_at).getTime() > 5 * 60_000) {
      await req.db.query('update sessions set last_seen_at = now() where id = $1', [id]);
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.', 'SESSAO_EXPIRADA');
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.', 'SESSAO_EXPIRADA');
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'Você não tem permissão para esta área.');
    next();
  };
}

/** Bloqueio simples de força bruta: 5 falhas em 15 minutos por login e por IP. */
const attempts = new Map<string, { count: number; until: number }>();
export function loginBlocked(key: string) {
  const a = attempts.get(key);
  return !!a && a.until > Date.now() && a.count >= 5;
}
export function loginFailed(key: string) {
  const a = attempts.get(key);
  if (!a || a.until < Date.now()) attempts.set(key, { count: 1, until: Date.now() + 15 * 60_000 });
  else a.count++;
  if (attempts.size > 10_000) for (const [k, v] of attempts) if (v.until < Date.now()) attempts.delete(k);
}
export function loginSucceeded(key: string) { attempts.delete(key); }

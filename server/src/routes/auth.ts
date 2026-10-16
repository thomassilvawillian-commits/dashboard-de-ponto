import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, passwordError, verifyPassword } from '../auth/password.js';
import { createSession, destroySession, loginBlocked, loginFailed, loginSucceeded, requireAuth } from '../auth/session.js';
import { isValidTimeZone, ymdIn } from '../domain/time.js';
import { HttpError, badRequest, clientIp, parse } from '../http.js';
import { audit } from '../services/audit.js';
import { getSettings, saveSettings } from '../services/settings.js';
import { DEFAULT_DAY_MINUTES, userDto } from '../services/users.js';

export const authRouter = Router();

const username = z.string().trim().min(2, 'Informe um usuário com pelo menos 2 caracteres.').max(60)
  .regex(/^[^=+@\-\s][^\s]*( [^\s]+)*$/, 'Usuário inválido.');

authRouter.get('/setup', async (req, res) => {
  const [{ n }] = await req.db.query<{ n: number }>('select count(*)::int as n from users');
  const s = await getSettings(req.db);
  res.json({ needsSetup: n === 0, companyName: s.companyName });
});

authRouter.post('/setup', async (req, res) => {
  const [{ n: existing }] = await req.db.query<{ n: number }>('select count(*)::int as n from users');
  if (existing > 0) throw new HttpError(409, 'O sistema já foi configurado.');
  const body = parse(z.object({
    companyName: z.string().trim().min(2, 'Informe o nome da empresa.').max(120),
    timezone: z.string().trim().refine(isValidTimeZone, 'Fuso horário inválido.'),
    name: z.string().trim().min(2, 'Informe seu nome.').max(120),
    username,
    password: z.string(),
  }), req.body);
  const err = passwordError(body.password);
  if (err) throw badRequest(err);
  const hash = await hashPassword(body.password);
  const user = await req.db.tx(async (q) => {
    await q.query('lock table users in exclusive mode');
    const [{ n }] = await q.query<{ n: number }>('select count(*)::int as n from users');
    if (n > 0) throw new HttpError(409, 'O sistema já foi configurado.');
    await saveSettings(q, { companyName: body.companyName, timezone: body.timezone });
    const today = ymdIn(new Date(), body.timezone);
    const [u] = await q.query(
      `insert into users (name, username, password_hash, role, start_date, track_time)
       values ($1,$2,$3,'ADMIN',$4,false) returning *`, [body.name, body.username, hash, today]);
    await q.query('insert into schedules (user_id, valid_from, day_minutes, expected_start) values ($1,$2,$3::jsonb,$4)',
      [u.id, today, JSON.stringify(DEFAULT_DAY_MINUTES), '09:00']);
    await audit(q, u.id, 'setup', 'system', null, { companyName: body.companyName });
    return u;
  });
  await createSession(req.db, req, res, user.id);
  res.status(201).json({ user: userDto(user) });
});

authRouter.post('/login', async (req, res) => {
  const body = parse(z.object({ username: z.string().trim().min(1, 'Informe seu usuário.'), password: z.string().min(1, 'Informe sua senha.') }), req.body);
  const keys = ['u:' + body.username.toLowerCase(), 'ip:' + clientIp(req)];
  if (keys.some(loginBlocked)) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  const [u] = await req.db.query('select * from users where lower(username) = lower($1)', [body.username]);
  const check = u ? await verifyPassword(body.password, u.password_hash) : { ok: false, legacy: false };
  if (!u || !u.active || !check.ok) {
    keys.forEach(loginFailed);
    throw new HttpError(401, 'Usuário ou senha incorretos, ou acesso desativado.');
  }
  keys.forEach(loginSucceeded);
  if (check.legacy) await req.db.query('update users set password_hash = $1 where id = $2', [await hashPassword(body.password), u.id]);
  await createSession(req.db, req, res, u.id);
  await audit(req.db, u.id, 'login', 'user', u.id, { ip: clientIp(req) });
  res.json({ user: userDto(u) });
});

authRouter.post('/logout', async (req, res) => {
  await destroySession(req.db, req, res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const [u] = await req.db.query('select * from users where id = $1', [req.user!.id]);
  const s = await getSettings(req.db);
  res.json({ user: userDto(u), company: { name: s.companyName, timezone: s.timezone } });
});

authRouter.post('/password', requireAuth, async (req, res) => {
  const body = parse(z.object({ current: z.string(), next: z.string() }), req.body);
  const err = passwordError(body.next);
  if (err) throw badRequest(err);
  const [u] = await req.db.query('select password_hash from users where id = $1', [req.user!.id]);
  if (!(await verifyPassword(body.current, u.password_hash)).ok) throw badRequest('A senha atual não confere.');
  await req.db.query('update users set password_hash = $1, must_change_password = false, updated_at = now() where id = $2', [await hashPassword(body.next), req.user!.id]);
  await req.db.query('delete from sessions where user_id = $1 and id <> $2', [req.user!.id, req.user!.sessionId]);
  await audit(req.db, req.user!.id, 'password.change', 'user', req.user!.id);
  res.json({ ok: true });
});

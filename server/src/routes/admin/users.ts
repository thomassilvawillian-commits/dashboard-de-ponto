import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, passwordError, temporaryPassword } from '../../auth/password.js';
import { requireRole } from '../../auth/session.js';
import { isValidDate, ymdIn, zonedToUtc } from '../../domain/time.js';
import { HttpError, badRequest, notFound, parse } from '../../http.js';
import { audit } from '../../services/audit.js';
import { assertPunchAllowed, insertPunch } from '../../services/requests.js';
import { getSettings } from '../../services/settings.js';
import { loadContext, monthFor } from '../../services/timesheet.js';
import { DEFAULT_DAY_MINUTES, activeAdminCount, scheduleDto, userDto } from '../../services/users.js';
import { monthParam } from '../me.js';

export const usersRouter = Router();
const adminOnly = requireRole('ADMIN');

const date = z.string().refine(isValidDate, 'Data inválida.');
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.');
const scheduleSchema = z.object({
  validFrom: date.optional(),
  dayMinutes: z.record(z.enum(['0', '1', '2', '3', '4', '5', '6']), z.number().int().min(0).max(1440)),
  expectedStart: hm.nullish(),
  breakMinutes: z.number().int().min(0).max(600).default(60),
});
const userFields = {
  name: z.string().trim().min(2, 'Informe o nome.').max(120),
  username: z.string().trim().min(2, 'Informe o usuário.').max(60).regex(/^[^=+@\-\s][^\s]*( [^\s]+)*$/, 'Usuário inválido.'),
  email: z.string().trim().email('E-mail inválido.').max(200).nullish().or(z.literal('')),
  role: z.enum(['ADMIN', 'GESTOR', 'FUNCIONARIO']),
  registration: z.string().trim().max(40).nullish(),
  department: z.string().trim().max(80).nullish(),
  jobTitle: z.string().trim().max(80).nullish(),
  startDate: date,
  endDate: date.nullish(),
  initialBalanceMin: z.number().int().min(-100000).max(100000),
  trackTime: z.boolean(),
  active: z.boolean(),
};

const userListSql = `
  select u.*, s.day_minutes, s.expected_start, s.valid_from, s.break_minutes
    from users u
    left join lateral (select * from schedules where user_id = u.id and valid_from <= $1 order by valid_from desc limit 1) s on true
   order by u.active desc, lower(u.name)`;

usersRouter.get('/users', async (req, res) => {
  const s = await getSettings(req.db);
  const rows = await req.db.query(userListSql, [ymdIn(new Date(), s.timezone)]);
  res.json({
    users: rows.map((r) => ({
      ...userDto(r),
      schedule: r.day_minutes ? { dayMinutes: r.day_minutes, expectedStart: r.expected_start, validFrom: r.valid_from, breakMinutes: r.break_minutes } : null,
    })),
  });
});

usersRouter.get('/users/:id', async (req, res) => {
  const [u] = await req.db.query('select * from users where id = $1', [Number(req.params.id)]);
  if (!u) throw notFound('Colaborador não encontrado.');
  const schedules = await req.db.query('select * from schedules where user_id = $1 order by valid_from desc', [u.id]);
  res.json({ user: userDto(u), schedules: schedules.map(scheduleDto) });
});

usersRouter.post('/users', adminOnly, async (req, res) => {
  const body = parse(z.object({
    ...userFields,
    endDate: userFields.endDate.optional(),
    active: userFields.active.default(true),
    trackTime: userFields.trackTime.default(true),
    initialBalanceMin: userFields.initialBalanceMin.default(0),
    password: z.string().optional(),
    schedule: scheduleSchema.optional(),
  }), req.body);
  if (body.password) { const e = passwordError(body.password); if (e) throw badRequest(e); }
  const password = body.password || temporaryPassword();
  const hash = await hashPassword(password);
  const user = await req.db.tx(async (q) => {
    const dup = await q.query('select 1 from users where lower(username) = lower($1)', [body.username]);
    if (dup.length) throw new HttpError(409, 'Já existe um colaborador com esse usuário.');
    const [u] = await q.query(
      `insert into users (name, username, email, password_hash, role, registration, department, job_title, start_date, end_date, initial_balance_min, track_time, active, must_change_password)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true) returning *`,
      [body.name, body.username, body.email || null, hash, body.role, body.registration || null, body.department || null, body.jobTitle || null,
        body.startDate, body.endDate || null, body.initialBalanceMin, body.trackTime, body.active]);
    const sch = body.schedule || { dayMinutes: DEFAULT_DAY_MINUTES, expectedStart: '09:00', breakMinutes: 60 };
    await q.query('insert into schedules (user_id, valid_from, day_minutes, expected_start, break_minutes) values ($1,$2,$3::jsonb,$4,$5)',
      [u.id, body.startDate, JSON.stringify({ ...DEFAULT_DAY_MINUTES, ...sch.dayMinutes }), sch.expectedStart || null, sch.breakMinutes]);
    await audit(q, req.user!.id, 'user.create', 'user', u.id, { name: u.name, role: u.role });
    return u;
  });
  res.status(201).json({ user: userDto(user), temporaryPassword: body.password ? undefined : password });
});

usersRouter.patch('/users/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const body = parse(z.object(userFields).partial(), req.body);
  const user = await req.db.tx(async (q) => {
    const [cur] = await q.query('select * from users where id = $1 for update', [id]);
    if (!cur) throw notFound('Colaborador não encontrado.');
    const losingAdmin = cur.role === 'ADMIN' && cur.active && ((body.role && body.role !== 'ADMIN') || body.active === false);
    if (losingAdmin && (await activeAdminCount(q, id)) === 0) throw badRequest('É preciso manter pelo menos um administrador ativo.');
    if (body.username && body.username.toLowerCase() !== cur.username.toLowerCase()) {
      const dup = await q.query('select 1 from users where lower(username) = lower($1) and id <> $2', [body.username, id]);
      if (dup.length) throw new HttpError(409, 'Já existe um colaborador com esse usuário.');
    }
    const map: Record<string, string> = {
      name: 'name', username: 'username', email: 'email', role: 'role', registration: 'registration', department: 'department',
      jobTitle: 'job_title', startDate: 'start_date', endDate: 'end_date', initialBalanceMin: 'initial_balance_min', trackTime: 'track_time', active: 'active',
    };
    const sets: string[] = [], vals: unknown[] = [];
    for (const [k, col] of Object.entries(map)) {
      if (!(k in body)) continue;
      let v = (body as any)[k];
      if (v === '') v = null;
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    }
    if (!sets.length) return cur;
    vals.push(id);
    const [u] = await q.query(`update users set ${sets.join(', ')}, updated_at = now() where id = $${vals.length} returning *`, vals);
    if (body.active === false || (body.role && body.role !== cur.role)) await q.query('delete from sessions where user_id = $1', [id]);
    await audit(q, req.user!.id, 'user.update', 'user', id, body);
    return u;
  });
  res.json({ user: userDto(user) });
});

usersRouter.post('/users/:id/reset-password', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const password = temporaryPassword();
  const rows = await req.db.query('update users set password_hash = $1, must_change_password = true, updated_at = now() where id = $2 returning id',
    [await hashPassword(password), id]);
  if (!rows.length) throw notFound('Colaborador não encontrado.');
  await req.db.query('delete from sessions where user_id = $1', [id]);
  await audit(req.db, req.user!.id, 'user.reset_password', 'user', id);
  res.json({ temporaryPassword: password });
});

usersRouter.post('/users/:id/schedules', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const body = parse(scheduleSchema.extend({ validFrom: date }), req.body);
  const [s] = await req.db.query(
    `insert into schedules (user_id, valid_from, day_minutes, expected_start, break_minutes) values ($1,$2,$3::jsonb,$4,$5)
     on conflict (user_id, valid_from) do update set day_minutes = excluded.day_minutes, expected_start = excluded.expected_start, break_minutes = excluded.break_minutes
     returning *`,
    [id, body.validFrom, JSON.stringify({ ...DEFAULT_DAY_MINUTES, ...body.dayMinutes }), body.expectedStart || null, body.breakMinutes]);
  await audit(req.db, req.user!.id, 'schedule.save', 'user', id, body);
  res.status(201).json({ schedule: scheduleDto(s) });
});

usersRouter.delete('/schedules/:id', adminOnly, async (req, res) => {
  const [s] = await req.db.query('select * from schedules where id = $1', [Number(req.params.id)]);
  if (!s) throw notFound('Jornada não encontrada.');
  const [{ n }] = await req.db.query<{ n: number }>('select count(*)::int as n from schedules where user_id = $1', [s.user_id]);
  if (n <= 1) throw badRequest('O colaborador precisa ter ao menos uma jornada cadastrada.');
  await req.db.query('delete from schedules where id = $1', [s.id]);
  await audit(req.db, req.user!.id, 'schedule.delete', 'user', s.user_id, scheduleDto(s));
  res.json({ ok: true });
});

usersRouter.get('/users/:id/month', async (req, res) => {
  const id = Number(req.params.id);
  const ctx = await loadContext(req.db);
  const m = monthParam(req.query.m, ctx.tz);
  const summary = (await monthFor(req.db, [id], m, ctx)).get(id);
  if (!summary) throw notFound('Colaborador não encontrado.');
  const [u] = await req.db.query('select * from users where id = $1', [id]);
  res.json({ user: userDto(u), summary, today: ctx.today });
});

/** Gestores não corrigem o próprio ponto: isso passa por solicitação aprovada por outra pessoa. */
function assertNotSelf(req: { user?: { id: number; role: string } }, userId: number) {
  if (req.user!.role !== 'ADMIN' && req.user!.id === userId) throw new HttpError(403, 'Ajustes no seu próprio ponto devem ser solicitados e aprovados por outro gestor.');
}

usersRouter.post('/users/:id/punches', async (req, res) => {
  const id = Number(req.params.id);
  assertNotSelf(req, id);
  const body = parse(z.object({ date, time: hm, note: z.string().trim().min(3, 'Informe o motivo do lançamento.').max(300) }), req.body);
  const ctx = await loadContext(req.db);
  const ts = zonedToUtc(body.date, body.time, ctx.tz);
  const p = await req.db.tx(async (q) => {
    const workDate = await assertPunchAllowed(q, id, ts, ctx.tz);
    const p = await insertPunch(q, id, ts, workDate, 'ajuste', { note: body.note, createdBy: req.user!.id });
    await audit(q, req.user!.id, 'punch.create', 'punch', p.id, { userId: id, ...body });
    return p;
  });
  res.status(201).json({ punch: { id: p.id } });
});

usersRouter.delete('/punches/:id', async (req, res) => {
  const body = parse(z.object({ reason: z.string().trim().min(3, 'Informe o motivo.').max(300) }), req.body ?? {});
  const [target] = await req.db.query('select user_id from punches where id = $1', [Number(req.params.id)]);
  if (target) assertNotSelf(req, target.user_id);
  const rows = await req.db.query('update punches set deleted_at = now(), deleted_by = $1, delete_reason = $2 where id = $3 and deleted_at is null returning id, user_id',
    [req.user!.id, body.reason, Number(req.params.id)]);
  if (!rows.length) throw notFound('Marcação não encontrada.');
  await audit(req.db, req.user!.id, 'punch.delete', 'punch', String(req.params.id), { userId: rows[0].user_id, reason: body.reason });
  res.json({ ok: true });
});

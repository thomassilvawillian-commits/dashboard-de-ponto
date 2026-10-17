import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/session.js';
import { punchLabel } from '../domain/calc.js';
import { isValidDate, isValidMonth, ymdIn, zonedToUtc } from '../domain/time.js';
import { HttpError, badRequest, notFound, parse } from '../http.js';
import { audit } from '../services/audit.js';
import { applyRequest, assertPunchAllowed, insertPunch, requestDto } from '../services/requests.js';
import { loadContext, monthFor, todayFor } from '../services/timesheet.js';
import { currentSchedule } from '../services/users.js';

export const meRouter = Router();
meRouter.use(requireAuth);

export const monthParam = (v: unknown, tz: string) => {
  const m = String(v || ymdIn(new Date(), tz).slice(0, 7));
  if (!isValidMonth(m)) throw badRequest('Mês inválido.');
  return m;
};

meRouter.get('/today', async (req, res) => {
  const ctx = await loadContext(req.db);
  const t = await todayFor(req.db, req.user!.id, ctx);
  const schedule = await currentSchedule(req.db, req.user!.id, ctx.today);
  const n = t.day.punches.length;
  res.json({
    now: ctx.now.toISOString(), today: ctx.today, timezone: ctx.tz,
    day: t.day, bankMin: t.bank.balanceMin, schedule,
    next: { index: n, label: punchLabel(n), isEntry: n % 2 === 0 },
    sharedComputer: ctx.settings.sharedComputer,
  });
});

meRouter.post('/punch', async (req, res) => {
  const ctx = await loadContext(req.db);
  const p = await req.db.tx(async (q) => {
    await q.query('select id from users where id = $1 for update', [req.user!.id]);
    const [last] = await q.query('select ts from punches where user_id = $1 and deleted_at is null order by ts desc limit 1', [req.user!.id]);
    if (last && Date.now() - new Date(last.ts).getTime() < 60_000) {
      throw new HttpError(409, 'Marcação já registrada há instantes. Aguarde um minuto para registrar a próxima.');
    }
    const now = new Date();
    return insertPunch(q, req.user!.id, now, ymdIn(now, ctx.tz), 'web');
  });
  const t = await todayFor(req.db, req.user!.id, await loadContext(req.db));
  const idx = t.day.punches.findIndex((x) => x.id === p.id);
  res.status(201).json({ punch: { id: p.id, ts: p.ts, label: punchLabel(idx < 0 ? 0 : idx) }, day: t.day });
});

meRouter.get('/month', async (req, res) => {
  const ctx = await loadContext(req.db);
  const m = monthParam(req.query.m, ctx.tz);
  const s = (await monthFor(req.db, [req.user!.id], m, ctx)).get(req.user!.id);
  res.json({ summary: s, today: ctx.today });
});

meRouter.get('/requests', async (req, res) => {
  const ctx = await loadContext(req.db);
  const rows = await req.db.query(
    `select r.*, p.ts as punch_ts, d.name as decided_by_name from punch_requests r
       left join punches p on p.id = r.punch_id left join users d on d.id = r.decided_by
      where r.user_id = $1 order by r.created_at desc limit 50`, [req.user!.id]);
  res.json({ requests: rows.map((r) => requestDto(r, ctx.tz)) });
});

meRouter.post('/requests', async (req, res) => {
  const body = parse(z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('ADD'), date: z.string().refine(isValidDate, 'Data inválida.'), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.'), reason: z.string().trim().min(3, 'Explique o motivo do ajuste.').max(300) }),
    z.object({ kind: z.literal('REMOVE'), punchId: z.number().int().positive(), reason: z.string().trim().min(3, 'Explique o motivo do ajuste.').max(300) }),
  ]), req.body);
  const ctx = await loadContext(req.db);
  const userId = req.user!.id;
  const created = await req.db.tx(async (q) => {
    let row;
    if (body.kind === 'ADD') {
      const ts = zonedToUtc(body.date, body.time, ctx.tz);
      await assertPunchAllowed(q, userId, ts, ctx.tz);
      const dup = await q.query(`select 1 from punch_requests where user_id = $1 and status = 'PENDENTE' and kind = 'ADD' and ts = $2`, [userId, ts]);
      if (dup.length) throw badRequest('Já existe uma solicitação pendente para esse horário.');
      [row] = await q.query(`insert into punch_requests (user_id, kind, work_date, ts, reason) values ($1,'ADD',$2,$3,$4) returning *`,
        [userId, ymdIn(ts, ctx.tz), ts, body.reason]);
    } else {
      const [p] = await q.query('select * from punches where id = $1 and user_id = $2 and deleted_at is null', [body.punchId, userId]);
      if (!p) throw notFound('Marcação não encontrada.');
      [row] = await q.query(`insert into punch_requests (user_id, kind, work_date, punch_id, reason) values ($1,'REMOVE',$2,$3,$4) returning *`,
        [userId, p.work_date, p.id, body.reason]);
    }
    await audit(q, userId, 'request.create', 'punch_request', row.id, body);
    if (ctx.settings.autoApproveRequests) await applyRequest(q, row, userId, ctx.tz, 'Aprovação automática');
    const [fresh] = await q.query('select r.*, p.ts as punch_ts from punch_requests r left join punches p on p.id = r.punch_id where r.id = $1', [row.id]);
    return fresh;
  });
  res.status(201).json({ request: requestDto(created, ctx.tz) });
});

meRouter.post('/requests/:id/cancel', async (req, res) => {
  const rows = await req.db.query(`update punch_requests set status = 'CANCELADO', decided_at = now() where id = $1 and user_id = $2 and status = 'PENDENTE' returning id`,
    [Number(req.params.id), req.user!.id]);
  if (!rows.length) throw notFound('Solicitação pendente não encontrada.');
  await audit(req.db, req.user!.id, 'request.cancel', 'punch_request', String(req.params.id));
  res.json({ ok: true });
});

/* Justificativa de falta: o colaborador abona o próprio dia, sem aprovação do RH.
   Fica registrada como ausência (visível e removível pelo RH) e na auditoria. */
export const JUSTIFICATION_TYPES = ['ATESTADO', 'ABONO', 'FOLGA', 'LICENCA'] as const;

meRouter.get('/absences', async (req, res) => {
  const rows = await req.db.query(
    `select a.id, a.start_date, a.end_date, a.type, a.note, a.created_by from absences a
      where a.user_id = $1 order by a.start_date desc limit 100`, [req.user!.id]);
  res.json({
    absences: rows.map((a) => ({ id: a.id, startDate: a.start_date, endDate: a.end_date, type: a.type, note: a.note, mine: a.created_by === req.user!.id })),
  });
});

meRouter.post('/absences', async (req, res) => {
  const date = z.string().refine(isValidDate, 'Data inválida.');
  const body = parse(z.object({
    startDate: date,
    endDate: date.optional(),
    type: z.enum(JUSTIFICATION_TYPES, { errorMap: () => ({ message: 'Escolha o tipo de justificativa.' }) }),
    note: z.string().trim().min(3, 'Escreva o motivo da falta.').max(300),
  }), req.body);
  const ctx = await loadContext(req.db);
  const end = body.endDate || body.startDate;
  if (end < body.startDate) throw badRequest('A data final deve ser igual ou posterior à inicial.');
  if (end > ctx.today) throw badRequest('Só é possível justificar dias até hoje.');
  const [u] = await req.db.query('select start_date from users where id = $1', [req.user!.id]);
  if (body.startDate < u.start_date) throw badRequest('A data é anterior ao início do seu registro de ponto.');
  const overlap = await req.db.query('select 1 from absences where user_id = $1 and start_date <= $3 and end_date >= $2', [req.user!.id, body.startDate, end]);
  if (overlap.length) throw badRequest('Esse dia já tem uma justificativa ou ausência registrada.');
  const [a] = await req.db.query(
    'insert into absences (user_id, start_date, end_date, type, note, created_by) values ($1,$2,$3,$4,$5,$1) returning id',
    [req.user!.id, body.startDate, end, body.type, body.note]);
  await audit(req.db, req.user!.id, 'absence.justify', 'absence', a.id, { ...body, endDate: end });
  res.status(201).json({ id: a.id });
});

meRouter.delete('/absences/:id', async (req, res) => {
  const rows = await req.db.query('delete from absences where id = $1 and user_id = $2 and created_by = $2 returning *', [Number(req.params.id), req.user!.id]);
  if (!rows.length) throw notFound('Justificativa não encontrada ou registrada pelo RH.');
  await audit(req.db, req.user!.id, 'absence.delete', 'absence', String(req.params.id), rows[0]);
  res.json({ ok: true });
});

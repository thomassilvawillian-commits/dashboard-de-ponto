import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../auth/session.js';
import { ABSENCE_TYPES } from '../../domain/calc.js';
import { brazilNationalHolidays, isValidDate } from '../../domain/time.js';
import { HttpError, badRequest, notFound, parse } from '../../http.js';
import { audit } from '../../services/audit.js';
import { applyRequest, requestDto } from '../../services/requests.js';
import { getSettings } from '../../services/settings.js';

export const opsRouter = Router();
const adminOnly = requireRole('ADMIN');
const date = z.string().refine(isValidDate, 'Data inválida.');
const note = z.object({ note: z.string().trim().max(300).nullish() });

/* Solicitações de ajuste */
opsRouter.get('/requests', async (req, res) => {
  const s = await getSettings(req.db);
  const status = String(req.query.status || 'PENDENTE');
  const params: unknown[] = [];
  let where = '';
  if (status !== 'TODAS') { params.push(status); where = 'where r.status = $1'; }
  const rows = await req.db.query(
    `select r.*, u.name as user_name, p.ts as punch_ts, d.name as decided_by_name
       from punch_requests r join users u on u.id = r.user_id
       left join punches p on p.id = r.punch_id left join users d on d.id = r.decided_by
       ${where} order by r.created_at desc limit 200`, params);
  res.json({ requests: rows.map((r) => requestDto(r, s.timezone)) });
});

opsRouter.post('/requests/:id/approve', async (req, res) => {
  const body = parse(note, req.body ?? {});
  const s = await getSettings(req.db);
  await req.db.tx(async (q) => {
    const [r] = await q.query('select * from punch_requests where id = $1 for update', [Number(req.params.id)]);
    if (!r) throw notFound('Solicitação não encontrada.');
    if (r.user_id === req.user!.id && req.user!.role !== 'ADMIN') throw new HttpError(403, 'Suas próprias solicitações devem ser aprovadas por outro gestor.');
    await applyRequest(q, r, req.user!.id, s.timezone, body.note);
  });
  res.json({ ok: true });
});

opsRouter.post('/requests/:id/reject', async (req, res) => {
  const body = parse(note, req.body ?? {});
  const rows = await req.db.query(
    `update punch_requests set status = 'REJEITADO', decided_by = $1, decided_at = now(), decision_note = $2
      where id = $3 and status = 'PENDENTE' returning id`, [req.user!.id, body.note ?? null, Number(req.params.id)]);
  if (!rows.length) throw new HttpError(409, 'Solicitação não encontrada ou já decidida.');
  await audit(req.db, req.user!.id, 'request.reject', 'punch_request', String(req.params.id), body);
  res.json({ ok: true });
});

/* Feriados */
opsRouter.get('/holidays', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const rows = await req.db.query('select id, date, name from holidays where date between $1 and $2 order by date', [`${year}-01-01`, `${year}-12-31`]);
  res.json({ holidays: rows });
});

opsRouter.post('/holidays', adminOnly, async (req, res) => {
  const body = parse(z.object({ date, name: z.string().trim().min(2, 'Informe o nome do feriado.').max(120) }), req.body);
  const [h] = await req.db.query(
    'insert into holidays (date, name) values ($1,$2) on conflict (date) do update set name = excluded.name returning id, date, name', [body.date, body.name]);
  await audit(req.db, req.user!.id, 'holiday.save', 'holiday', h.id, body);
  res.status(201).json({ holiday: h });
});

opsRouter.post('/holidays/national', adminOnly, async (req, res) => {
  const body = parse(z.object({ year: z.number().int().min(2000).max(2100) }), req.body);
  let added = 0;
  for (const h of brazilNationalHolidays(body.year)) {
    const rows = await req.db.query('insert into holidays (date, name) values ($1,$2) on conflict (date) do nothing returning id', [h.date, h.name]);
    added += rows.length;
  }
  await audit(req.db, req.user!.id, 'holiday.import_national', 'holiday', null, { year: body.year, added });
  res.json({ added });
});

opsRouter.delete('/holidays/:id', adminOnly, async (req, res) => {
  const rows = await req.db.query('delete from holidays where id = $1 returning date, name', [Number(req.params.id)]);
  if (!rows.length) throw notFound('Feriado não encontrado.');
  await audit(req.db, req.user!.id, 'holiday.delete', 'holiday', String(req.params.id), rows[0]);
  res.json({ ok: true });
});

/* Ausências: férias, atestados, licenças, abonos, folgas e compensações */
opsRouter.get('/absences', async (req, res) => {
  const params: unknown[] = [];
  const where: string[] = [];
  if (req.query.userId) { params.push(Number(req.query.userId)); where.push(`a.user_id = $${params.length}`); }
  if (req.query.from) { params.push(String(req.query.from)); where.push(`a.end_date >= $${params.length}`); }
  if (req.query.to) { params.push(String(req.query.to)); where.push(`a.start_date <= $${params.length}`); }
  const rows = await req.db.query(
    `select a.id, a.user_id, u.name as user_name, a.start_date, a.end_date, a.type, a.note, a.created_at, a.created_by = a.user_id as self_justified
       from absences a join users u on u.id = a.user_id ${where.length ? 'where ' + where.join(' and ') : ''}
      order by a.start_date desc limit 500`, params);
  res.json({
    absences: rows.map((a) => ({ id: a.id, userId: a.user_id, userName: a.user_name, startDate: a.start_date, endDate: a.end_date, type: a.type, note: a.note, selfJustified: a.self_justified })),
    types: ABSENCE_TYPES,
  });
});

opsRouter.post('/absences', async (req, res) => {
  const body = parse(z.object({
    userId: z.number().int().positive(), startDate: date, endDate: date,
    type: z.string().refine((t) => t in ABSENCE_TYPES, 'Tipo de ausência inválido.'),
    note: z.string().trim().max(300).nullish(),
  }), req.body);
  if (body.endDate < body.startDate) throw badRequest('A data final deve ser igual ou posterior à inicial.');
  const overlap = await req.db.query('select 1 from absences where user_id = $1 and start_date <= $3 and end_date >= $2', [body.userId, body.startDate, body.endDate]);
  if (overlap.length) throw badRequest('Já existe uma ausência registrada nesse período.');
  const [a] = await req.db.query(
    'insert into absences (user_id, start_date, end_date, type, note, created_by) values ($1,$2,$3,$4,$5,$6) returning id',
    [body.userId, body.startDate, body.endDate, body.type, body.note ?? null, req.user!.id]);
  await audit(req.db, req.user!.id, 'absence.create', 'absence', a.id, body);
  res.status(201).json({ id: a.id });
});

opsRouter.delete('/absences/:id', async (req, res) => {
  const rows = await req.db.query('delete from absences where id = $1 returning *', [Number(req.params.id)]);
  if (!rows.length) throw notFound('Ausência não encontrada.');
  await audit(req.db, req.user!.id, 'absence.delete', 'absence', String(req.params.id), rows[0]);
  res.json({ ok: true });
});

/* Movimentações do banco de horas: pagamento, folga, correção */
export const ADJUSTMENT_KINDS: Record<string, string> = {
  PAGAMENTO: 'Pagamento de horas extras',
  DESCONTO: 'Desconto em folha',
  CORRECAO: 'Correção de saldo',
  BONUS: 'Crédito concedido',
};

opsRouter.get('/adjustments', async (req, res) => {
  const params: unknown[] = [];
  let where = '';
  if (req.query.userId) { params.push(Number(req.query.userId)); where = 'where b.user_id = $1'; }
  const rows = await req.db.query(
    `select b.*, u.name as user_name, c.name as created_by_name from bank_adjustments b
       join users u on u.id = b.user_id left join users c on c.id = b.created_by ${where}
      order by b.date desc, b.id desc limit 500`, params);
  res.json({
    adjustments: rows.map((b) => ({ id: b.id, userId: b.user_id, userName: b.user_name, date: b.date, minutes: b.minutes, kind: b.kind, note: b.note, createdBy: b.created_by_name })),
    kinds: ADJUSTMENT_KINDS,
  });
});

opsRouter.post('/adjustments', adminOnly, async (req, res) => {
  const body = parse(z.object({
    userId: z.number().int().positive(), date,
    minutes: z.number().int().min(-100000).max(100000).refine((m) => m !== 0, 'Informe a quantidade de horas.'),
    kind: z.string().refine((k) => k in ADJUSTMENT_KINDS, 'Tipo inválido.'),
    note: z.string().trim().max(300).nullish(),
  }), req.body);
  const [b] = await req.db.query(
    'insert into bank_adjustments (user_id, date, minutes, kind, note, created_by) values ($1,$2,$3,$4,$5,$6) returning id',
    [body.userId, body.date, body.minutes, body.kind, body.note ?? null, req.user!.id]);
  await audit(req.db, req.user!.id, 'adjustment.create', 'bank_adjustment', b.id, body);
  res.status(201).json({ id: b.id });
});

opsRouter.delete('/adjustments/:id', adminOnly, async (req, res) => {
  const rows = await req.db.query('delete from bank_adjustments where id = $1 returning *', [Number(req.params.id)]);
  if (!rows.length) throw notFound('Movimentação não encontrada.');
  await audit(req.db, req.user!.id, 'adjustment.delete', 'bank_adjustment', String(req.params.id), rows[0]);
  res.json({ ok: true });
});

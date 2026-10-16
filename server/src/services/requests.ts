import type { Queryable } from '../db/index.js';
import { hmIn, ymdIn } from '../domain/time.js';
import { HttpError, badRequest } from '../http.js';
import { audit } from './audit.js';

export function requestDto(r: any, tz: string) {
  return {
    id: r.id, userId: r.user_id, userName: r.user_name ?? undefined, kind: r.kind, date: r.work_date,
    time: r.ts ? hmIn(new Date(r.ts), tz) : r.punch_ts ? hmIn(new Date(r.punch_ts), tz) : null,
    punchId: r.punch_id, reason: r.reason, status: r.status, decidedBy: r.decided_by_name ?? null,
    decidedAt: r.decided_at, decisionNote: r.decision_note, createdAt: r.created_at,
  };
}

/** Confere se uma marcação manual pode entrar no dia (sem futuro e sem duplicar o mesmo minuto). */
export async function assertPunchAllowed(q: Queryable, userId: number, ts: Date, tz: string) {
  if (ts.getTime() > Date.now()) throw badRequest('Não é possível registrar um horário futuro.');
  const date = ymdIn(ts, tz);
  const [u] = await q.query('select start_date, end_date from users where id = $1', [userId]);
  if (date < u.start_date || (u.end_date && date > u.end_date)) throw badRequest('A data está fora do período de apuração do colaborador.');
  const same = await q.query(
    `select 1 from punches where user_id = $1 and deleted_at is null and date_trunc('minute', ts) = date_trunc('minute', $2::timestamptz)`, [userId, ts]);
  if (same.length) throw badRequest('Já existe uma marcação nesse horário.');
  return date;
}

export async function insertPunch(q: Queryable, userId: number, ts: Date, workDate: string, source: string, extra: { note?: string | null; createdBy?: number | null; ip?: string; userAgent?: string; latitude?: number | null; longitude?: number | null; accuracy?: number | null } = {}) {
  const [p] = await q.query(
    `insert into punches (user_id, ts, work_date, source, note, created_by, ip, user_agent, latitude, longitude, accuracy)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
    [userId, ts, workDate, source, extra.note ?? null, extra.createdBy ?? null, extra.ip ?? null, extra.userAgent ?? null, extra.latitude ?? null, extra.longitude ?? null, extra.accuracy ?? null]);
  return p;
}

/** Aplica uma solicitação aprovada: inclui a marcação pedida ou desconsidera a marcação indicada. */
export async function applyRequest(q: Queryable, r: any, actorId: number, tz: string, note?: string | null) {
  if (r.status !== 'PENDENTE') throw new HttpError(409, 'Essa solicitação já foi decidida.');
  let punchId = r.punch_id;
  if (r.kind === 'ADD') {
    const ts = new Date(r.ts);
    const date = await assertPunchAllowed(q, r.user_id, ts, tz);
    const p = await insertPunch(q, r.user_id, ts, date, 'ajuste', { note: r.reason, createdBy: actorId });
    punchId = p.id;
  } else {
    const rows = await q.query(`update punches set deleted_at = now(), deleted_by = $1, delete_reason = $2
       where id = $3 and user_id = $4 and deleted_at is null returning id`, [actorId, r.reason || 'Solicitação aprovada', r.punch_id, r.user_id]);
    if (!rows.length) throw badRequest('A marcação indicada não existe mais.');
  }
  await q.query(`update punch_requests set status = 'APROVADO', decided_by = $1, decided_at = now(), decision_note = $2, punch_id = $3 where id = $4`,
    [actorId, note ?? null, punchId, r.id]);
  await audit(q, actorId, 'request.approve', 'punch_request', r.id, { kind: r.kind, userId: r.user_id, note });
}

import type { Queryable } from '../db/index.js';
import { calcBank, calcDay, calcMonth, type CalcContext, type Punch, type PunchIndex, type UserCalc } from '../domain/calc.js';
import { addDays, monthBounds, ymdIn } from '../domain/time.js';
import { getSettings, type Settings } from './settings.js';

export async function loadContext(q: Queryable, settings?: Settings, now = new Date()): Promise<CalcContext & { settings: Settings }> {
  const s = settings || (await getSettings(q));
  const holidays = new Map<string, string>();
  for (const h of await q.query<{ date: string; name: string }>('select date, name from holidays')) holidays.set(h.date, h.name);
  return {
    tz: s.timezone, today: ymdIn(now, s.timezone), now,
    toleranceDailyMin: s.toleranceDailyMin, toleranceLateMin: s.toleranceLateMin, holidays, settings: s,
  };
}

export async function loadUsers(q: Queryable, ids?: number[]): Promise<Map<number, UserCalc>> {
  const filter = ids ? 'where id = any($1::int[])' : '';
  const params = ids ? [ids] : [];
  const users = await q.query(`select id, start_date, end_date, initial_balance_min, track_time from users ${filter}`, params);
  const map = new Map<number, UserCalc>();
  for (const u of users) {
    map.set(u.id, {
      id: u.id, startDate: u.start_date, endDate: u.end_date, initialBalanceMin: u.initial_balance_min,
      trackTime: u.track_time, schedules: [], absences: [], adjustments: [],
    });
  }
  const userFilter = ids ? 'where user_id = any($1::int[])' : '';
  for (const s of await q.query(`select user_id, valid_from, day_minutes, expected_start, break_minutes from schedules ${userFilter} order by valid_from`, params)) {
    map.get(s.user_id)?.schedules.push({ validFrom: s.valid_from, dayMinutes: s.day_minutes, expectedStart: s.expected_start, breakMinutes: s.break_minutes });
  }
  for (const a of await q.query(`select user_id, start_date, end_date, type from absences ${userFilter}`, params)) {
    map.get(a.user_id)?.absences.push({ startDate: a.start_date, endDate: a.end_date, type: a.type });
  }
  for (const a of await q.query(`select user_id, date, minutes from bank_adjustments ${userFilter}`, params)) {
    map.get(a.user_id)?.adjustments.push({ date: a.date, minutes: a.minutes });
  }
  return map;
}

export async function loadPunches(q: Queryable, ids: number[] | null, from: string, to: string): Promise<Map<number, PunchIndex>> {
  const params: unknown[] = [from, to];
  let sql = `select id, user_id, ts, work_date, source, note from punches
              where deleted_at is null and work_date between $1 and $2`;
  if (ids) { sql += ' and user_id = any($3::int[])'; params.push(ids); }
  const out = new Map<number, PunchIndex>();
  for (const p of await q.query(sql + ' order by ts', params)) {
    let idx = out.get(p.user_id);
    if (!idx) out.set(p.user_id, (idx = new Map()));
    const list = idx.get(p.work_date) || [];
    list.push({ id: p.id, ts: new Date(p.ts), source: p.source, note: p.note } as Punch);
    idx.set(p.work_date, list);
  }
  return out;
}

/** Resumo do mês e banco acumulado de um ou mais usuários, com uma leitura de cada tabela. */
export async function monthFor(q: Queryable, ids: number[] | null, ym: string, ctx?: CalcContext) {
  ctx = ctx || (await loadContext(q));
  const users = await loadUsers(q, ids || undefined);
  const { last } = monthBounds(ym);
  const earliest = [...users.values()].reduce((m, u) => (u.startDate < m ? u.startDate : m), addDays(monthBounds(ym).first, -1));
  const punches = await loadPunches(q, ids, earliest, last);
  const out = new Map<number, ReturnType<typeof calcMonth>>();
  for (const u of users.values()) out.set(u.id, calcMonth(u, ym, punches.get(u.id) || new Map(), ctx));
  return out;
}

export async function todayFor(q: Queryable, userId: number, ctx: CalcContext) {
  const users = await loadUsers(q, [userId]);
  const u = users.get(userId)!;
  const punches = (await loadPunches(q, [userId], u.startDate < ctx.today ? u.startDate : addDays(ctx.today, -1), ctx.today)).get(userId) || new Map();
  const yesterday = punches.get(addDays(ctx.today, -1));
  const prevLast = yesterday?.length ? yesterday[yesterday.length - 1].ts : undefined;
  return {
    day: calcDay(u, ctx.today, punches.get(ctx.today) || [], ctx, prevLast),
    bank: calcBank(u, ctx.today, punches, ctx),
    user: u,
  };
}

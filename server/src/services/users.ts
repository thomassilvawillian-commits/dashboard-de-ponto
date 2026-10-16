import type { Queryable } from '../db/index.js';

export const DEFAULT_DAY_MINUTES: Record<string, number> = { '0': 0, '1': 480, '2': 480, '3': 480, '4': 480, '5': 480, '6': 0 };

export function userDto(u: any) {
  return {
    id: u.id, name: u.name, username: u.username, email: u.email ?? null, role: u.role, active: u.active,
    registration: u.registration ?? null, department: u.department ?? null, jobTitle: u.job_title ?? null,
    startDate: u.start_date, endDate: u.end_date ?? null, initialBalanceMin: u.initial_balance_min,
    trackTime: u.track_time, mustChangePassword: u.must_change_password, createdAt: u.created_at,
  };
}

export function scheduleDto(s: any) {
  return { id: s.id, userId: s.user_id, validFrom: s.valid_from, dayMinutes: s.day_minutes, expectedStart: s.expected_start, breakMinutes: s.break_minutes };
}

export async function currentSchedule(q: Queryable, userId: number, date: string) {
  const rows = await q.query('select * from schedules where user_id = $1 and valid_from <= $2 order by valid_from desc limit 1', [userId, date]);
  return rows[0] ? scheduleDto(rows[0]) : null;
}

export async function activeAdminCount(q: Queryable, excludeId?: number) {
  const rows = await q.query<{ n: number }>(`select count(*)::int as n from users where role = 'ADMIN' and active and id <> $1`, [excludeId ?? 0]);
  return rows[0].n;
}

import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../auth/session.js';
import { calcDay, punchLabel, type DayResult, type MonthSummary } from '../../domain/calc.js';
import { addDays, isValidTimeZone } from '../../domain/time.js';
import { parse } from '../../http.js';
import { audit } from '../../services/audit.js';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../../services/settings.js';
import { loadContext, loadPunches, loadUsers, monthFor } from '../../services/timesheet.js';
import { monthParam } from '../me.js';

export const insightsRouter = Router();

function presence(day: DayResult): string {
  const n = day.punches.length;
  if (day.status === 'ausencia' || day.status === 'compensacao') return 'ausencia';
  if (day.status === 'feriado') return n ? (n % 2 ? 'trabalhando' : 'encerrado') : 'feriado';
  if (n === 0) return day.expectedMin > 0 ? 'nao_chegou' : 'folga';
  if (n % 2 === 1) return 'trabalhando';
  return n === 2 && day.expectedMin > 0 ? 'intervalo' : 'encerrado';
}

insightsRouter.get('/overview', async (req, res) => {
  const ctx = await loadContext(req.db);
  const m = monthParam(req.query.m, ctx.tz);
  const people = await req.db.query('select id, name, role, active, department, job_title, track_time from users order by lower(name)');
  const months = await monthFor(req.db, null, m, ctx);

  const users = await loadUsers(req.db);
  const todayPunches = await loadPunches(req.db, null, addDays(ctx.today, -1), ctx.today);
  const pending = await req.db.query<{ n: number }>(`select count(*)::int as n from punch_requests where status = 'PENDENTE'`);

  const team = people.map((p) => {
    const s = months.get(p.id) as MonthSummary;
    const idx = todayPunches.get(p.id) || new Map();
    const y = idx.get(addDays(ctx.today, -1));
    const today = calcDay(users.get(p.id)!, ctx.today, idx.get(ctx.today) || [], ctx, y?.length ? y[y.length - 1].ts : undefined);
    const last = today.punches[today.punches.length - 1];
    const { days, ...totals } = s;
    return {
      id: p.id, name: p.name, role: p.role, active: p.active, department: p.department, jobTitle: p.job_title, trackTime: p.track_time,
      month: totals,
      today: { presence: presence(today), status: today.status, workedMin: today.workedMin, expectedMin: today.expectedMin, lateMin: today.lateMin,
        lastPunch: last ? { time: last.time, label: punchLabel(today.punches.length - 1) } : null, punches: today.punches.length },
      alerts: days.flatMap((d) => d.alerts.map((a) => ({ date: d.date, alert: a }))),
    };
  });

  const tracked = team.filter((t) => t.active && t.trackTime);
  const sum = (f: (t: (typeof team)[number]) => number) => tracked.reduce((acc, t) => acc + f(t), 0);
  const presenceCount: Record<string, number> = {};
  for (const t of tracked) presenceCount[t.today.presence] = (presenceCount[t.today.presence] || 0) + 1;

  res.json({
    month: m, today: ctx.today, now: ctx.now.toISOString(),
    kpis: {
      people: tracked.length, absences: sum((t) => t.month.absences), pendingDays: sum((t) => t.month.pending), pendingRequests: pending[0].n,
    },
    presence: presenceCount,
    team,
  });
});

/* Relatórios CSV (separador ;, UTF-8 com BOM, abre direto no Excel) */
export function fmtMin(min: number) {
  const sign = min < 0 ? '-' : '';
  const a = Math.abs(Math.round(min));
  return `${sign}${Math.floor(a / 60)}h${String(a % 60).padStart(2, '0')}`;
}
function csv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+h\d{2}$/.test(s)) s = "'" + s;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
const STATUS_LABEL: Record<string, string> = {
  fora_periodo: 'Fora do período', futuro: 'Futuro', completo: 'Completo', em_andamento: 'Em andamento', incompleto: 'Pendente',
  falta: 'Falta', aguardando: 'Aguardando', folga: 'Folga', feriado: 'Feriado', ausencia: 'Ausência abonada', compensacao: 'Compensação',
};
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function idsParam(v: unknown) {
  const ids = String(v || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return ids.length ? ids : null;
}

insightsRouter.get('/reports/summary.csv', async (req, res) => {
  const ctx = await loadContext(req.db);
  const m = monthParam(req.query.m, ctx.tz);
  const ids = idsParam(req.query.ids);
  const months = await monthFor(req.db, ids, m, ctx);
  const people = await req.db.query('select id, name, registration, department, active from users order by lower(name)');
  const rows: (string | number | null)[][] = [['Colaborador', 'Matrícula', 'Departamento', 'Situação', 'Dias trabalhados', 'Faltas', 'Pendências', 'Atrasos (dias)',
    'Atraso total', 'Previsto', 'Trabalhado', 'Extras', 'Faltantes', 'Saldo do mês', 'Banco acumulado']];
  for (const p of people) {
    const s = months.get(p.id);
    if (!s) continue;
    rows.push([p.name, p.registration, p.department, p.active ? 'Ativo' : 'Inativo', s.daysWorked, s.absences, s.pending, s.lateDays,
      fmtMin(s.lateMin), fmtMin(s.expectedMin), fmtMin(s.workedMin), fmtMin(s.extraMin), fmtMin(s.missingMin), fmtMin(s.balanceMin), fmtMin(s.bankMin)]);
  }
  await audit(req.db, req.user!.id, 'report.summary', 'report', m, { ids });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="resumo_${m}.csv"`);
  res.send(csv(rows));
});

insightsRouter.get('/reports/timesheet.csv', async (req, res) => {
  const ctx = await loadContext(req.db);
  const m = monthParam(req.query.m, ctx.tz);
  const ids = idsParam(req.query.ids);
  const months = await monthFor(req.db, ids, m, ctx);
  const people = await req.db.query('select id, name, registration from users order by lower(name)');
  const rows: (string | number | null)[][] = [['Colaborador', 'Matrícula', 'Data', 'Dia', 'Situação', 'Marcações', 'Previsto', 'Trabalhado', 'Intervalo', 'Atraso', 'Saldo', 'Observação']];
  for (const p of people) {
    const s = months.get(p.id);
    if (!s) continue;
    for (const d of s.days) {
      if (d.status === 'fora_periodo') continue;
      const [y, mo, da] = d.date.split('-');
      rows.push([p.name, p.registration, `${da}/${mo}/${y}`, WEEKDAYS[d.weekday], STATUS_LABEL[d.status], d.punches.map((x) => x.time).join(' '),
        fmtMin(d.expectedMin), fmtMin(d.workedMin), fmtMin(d.breakMin), fmtMin(d.lateMin), fmtMin(d.balanceMin), d.holiday || d.absence || '']);
    }
  }
  await audit(req.db, req.user!.id, 'report.timesheet', 'report', m, { ids });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="espelho_${m}.csv"`);
  res.send(csv(rows));
});

/* Configurações */
insightsRouter.get('/settings', async (req, res) => {
  res.json({ settings: await getSettings(req.db), defaults: DEFAULT_SETTINGS });
});

insightsRouter.put('/settings', requireRole('ADMIN'), async (req, res) => {
  const body = parse(z.object({
    companyName: z.string().trim().min(2, 'Informe o nome da empresa.').max(120),
    timezone: z.string().refine(isValidTimeZone, 'Fuso horário inválido.'),
    toleranceDailyMin: z.number().int().min(0).max(60),
    toleranceLateMin: z.number().int().min(0).max(120),
    autoApproveRequests: z.boolean(),
  }).partial(), req.body);
  await saveSettings(req.db, body);
  await audit(req.db, req.user!.id, 'settings.update', 'settings', null, body);
  res.json({ settings: await getSettings(req.db) });
});

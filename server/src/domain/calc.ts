import { addDays, eachDay, hmIn, minDate, minuteOfDay, monthBounds, parseHm, weekday } from './time.js';

/** Regras de apuração da jornada. Funções puras: nada aqui acessa o banco. */

export interface ScheduleVersion {
  validFrom: string;
  /** Minutos esperados por dia da semana: chaves '0' (domingo) a '6' (sábado). */
  dayMinutes: Record<string, number>;
  expectedStart: string | null;
  breakMinutes: number;
}

export interface Absence { startDate: string; endDate: string; type: string }
export interface Adjustment { date: string; minutes: number }
export interface Punch { id: number; ts: Date; source: string; note?: string | null }

export interface UserCalc {
  id: number;
  startDate: string;
  endDate: string | null;
  initialBalanceMin: number;
  trackTime: boolean;
  schedules: ScheduleVersion[];
  absences: Absence[];
  adjustments: Adjustment[];
}

export interface CalcContext {
  tz: string;
  today: string;
  now: Date;
  /** Variação diária até este limite não gera crédito nem débito (CLT art. 58 §1º). */
  toleranceDailyMin: number;
  /** Atraso na entrada só é contado acima deste limite. */
  toleranceLateMin: number;
  holidays: Map<string, string>;
}

export type DayStatus =
  | 'fora_periodo' | 'futuro' | 'completo' | 'em_andamento' | 'incompleto'
  | 'falta' | 'aguardando' | 'folga' | 'feriado' | 'ausencia' | 'compensacao';

export type Alert = 'intervalo_insuficiente' | 'jornada_excedida' | 'interjornada' | 'marcacao_impar';

export interface DayResult {
  date: string;
  weekday: number;
  status: DayStatus;
  expectedMin: number;
  workedMin: number;
  balanceMin: number;
  lateMin: number;
  breakMin: number;
  punches: { id: number; time: string; source: string; note?: string | null }[];
  holiday?: string;
  absence?: string;
  alerts: Alert[];
}

export const ABSENCE_TYPES: Record<string, { label: string; abona: boolean }> = {
  FERIAS: { label: 'Férias', abona: true },
  ATESTADO: { label: 'Atestado médico', abona: true },
  LICENCA: { label: 'Licença', abona: true },
  ABONO: { label: 'Abono', abona: true },
  FOLGA: { label: 'Folga', abona: true },
  COMPENSACAO: { label: 'Compensação de banco de horas', abona: false },
};

export function scheduleFor(schedules: ScheduleVersion[], date: string): ScheduleVersion | null {
  let found: ScheduleVersion | null = null;
  for (const s of schedules) if (s.validFrom <= date && (!found || s.validFrom > found.validFrom)) found = s;
  return found;
}

export function calcDay(user: UserCalc, date: string, punchesIn: Punch[], ctx: CalcContext, prevLast?: Date): DayResult {
  const wd = weekday(date);
  const sched = scheduleFor(user.schedules, date);
  const holiday = ctx.holidays.get(date);
  const absence = user.absences.find((a) => a.startDate <= date && date <= a.endDate);
  const scheduled = user.trackTime && sched ? Math.max(0, Math.round(Number(sched.dayMinutes[String(wd)] || 0))) : 0;

  let expected = holiday ? 0 : scheduled;
  let abonado = false, compensa = false;
  if (absence && expected > 0) {
    if (ABSENCE_TYPES[absence.type]?.abona === false) compensa = true;
    else { abonado = true; expected = 0; }
  }

  const fora = date < user.startDate || (!!user.endDate && date > user.endDate);
  const futuro = date > ctx.today;
  const punches = [...punchesIn].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const n = punches.length;

  let worked = 0, breakMin = 0;
  for (let i = 0; i + 1 < n; i += 2) worked += (punches[i + 1].ts.getTime() - punches[i].ts.getTime()) / 60000;
  for (let i = 1; i + 1 < n; i += 2) breakMin += (punches[i + 1].ts.getTime() - punches[i].ts.getTime()) / 60000;
  const open = n % 2 === 1;
  if (open && date === ctx.today) worked += Math.max(0, (ctx.now.getTime() - punches[n - 1].ts.getTime()) / 60000);
  worked = Math.max(0, Math.round(worked));
  breakMin = Math.max(0, Math.round(breakMin));

  let status: DayStatus;
  if (fora) status = 'fora_periodo';
  else if (futuro) status = 'futuro';
  else if (n > 0 && !open) status = 'completo';
  else if (open) status = date === ctx.today ? 'em_andamento' : 'incompleto';
  else if (compensa) status = 'compensacao';
  else if (abonado) status = 'ausencia';
  else if (holiday && scheduled > 0) status = 'feriado';
  else if (expected > 0) status = date < ctx.today ? 'falta' : 'aguardando';
  else status = holiday ? 'feriado' : 'folga';

  let balance = 0;
  if (status === 'completo') {
    const raw = worked - expected;
    balance = Math.abs(raw) <= ctx.toleranceDailyMin ? 0 : raw;
  } else if (status === 'falta' || status === 'compensacao') balance = -expected;

  let late = 0;
  const startMin = parseHm(sched?.expectedStart);
  if (n > 0 && expected > 0 && startMin != null && !fora && !futuro) {
    const diff = Math.round(minuteOfDay(punches[0].ts, ctx.tz) - startMin);
    late = diff > ctx.toleranceLateMin ? diff : 0;
  }

  const alerts: Alert[] = [];
  if (!fora && !futuro) {
    if (status === 'incompleto') alerts.push('marcacao_impar');
    if (status === 'completo' && worked > 360 && breakMin < 55) alerts.push('intervalo_insuficiente');
    if (worked > 600) alerts.push('jornada_excedida');
    if (prevLast && n > 0 && (punches[0].ts.getTime() - prevLast.getTime()) / 60000 < 660) alerts.push('interjornada');
  }

  const counts = !fora && !futuro;
  return {
    date, weekday: wd, status,
    expectedMin: counts ? expected : 0,
    workedMin: fora ? 0 : worked,
    balanceMin: counts ? balance : 0,
    lateMin: late,
    breakMin,
    punches: punches.map((p) => ({ id: p.id, time: hmIn(p.ts, ctx.tz), source: p.source, note: p.note ?? null })),
    holiday,
    absence: absence?.type,
    alerts,
  };
}

export interface MonthSummary {
  month: string;
  days: DayResult[];
  workedMin: number;
  expectedMin: number;
  plannedMin: number;
  extraMin: number;
  missingMin: number;
  balanceMin: number;
  lateMin: number;
  lateDays: number;
  daysWorked: number;
  absences: number;
  pending: number;
  alerts: number;
  bankMin: number;
  bankPending: number;
}

export type PunchIndex = Map<string, Punch[]>;

function lastPunchBefore(index: PunchIndex, date: string): Date | undefined {
  const prev = index.get(addDays(date, -1));
  if (!prev?.length) return undefined;
  return prev.reduce((m, p) => (p.ts > m ? p.ts : m), prev[0].ts);
}

export function calcMonth(user: UserCalc, ym: string, index: PunchIndex, ctx: CalcContext): MonthSummary {
  const { first, last } = monthBounds(ym);
  const s: MonthSummary = {
    month: ym, days: [], workedMin: 0, expectedMin: 0, plannedMin: 0, extraMin: 0, missingMin: 0,
    balanceMin: 0, lateMin: 0, lateDays: 0, daysWorked: 0, absences: 0, pending: 0, alerts: 0, bankMin: 0, bankPending: 0,
  };
  for (const date of eachDay(first, last)) {
    const d = calcDay(user, date, index.get(date) || [], ctx, lastPunchBefore(index, date));
    s.days.push(d);
    s.workedMin += d.workedMin;
    s.expectedMin += d.expectedMin;
    s.balanceMin += d.balanceMin;
    if (d.balanceMin > 0) s.extraMin += d.balanceMin; else s.missingMin -= d.balanceMin;
    s.lateMin += d.lateMin;
    if (d.lateMin > 0) s.lateDays++;
    if (d.status === 'completo') s.daysWorked++;
    if (d.status === 'falta') s.absences++;
    if (d.status === 'incompleto') s.pending++;
    s.alerts += d.alerts.length;
    if (d.status !== 'fora_periodo') {
      const sched = scheduleFor(user.schedules, date);
      const planned = user.trackTime && sched && !ctx.holidays.has(date) ? Number(sched.dayMinutes[String(d.weekday)] || 0) : 0;
      const abonada = d.absence && ABSENCE_TYPES[d.absence]?.abona !== false;
      s.plannedMin += abonada ? 0 : planned;
    }
  }
  const bank = calcBank(user, last, index, ctx);
  s.bankMin = bank.balanceMin;
  s.bankPending = bank.pendingDays;
  return s;
}

/** Banco acumulado: saldo inicial + saldos diários + ajustes, do início da apuração até `until`. */
export function calcBank(user: UserCalc, until: string, index: PunchIndex, ctx: CalcContext) {
  const limit = minDate(until, ctx.today, user.endDate)!;
  const adjust = user.adjustments.filter((a) => a.date <= until).reduce((t, a) => t + a.minutes, 0);
  if (limit < user.startDate) return { balanceMin: adjust, pendingDays: 0 };
  let balance = user.initialBalanceMin + adjust, pending = 0;
  for (const date of eachDay(user.startDate, limit)) {
    const d = calcDay(user, date, index.get(date) || [], ctx);
    balance += d.balanceMin;
    if (d.status === 'incompleto') pending++;
  }
  return { balanceMin: balance, pendingDays: pending };
}

export const PUNCH_LABELS = ['Entrada', 'Saída para intervalo', 'Retorno do intervalo', 'Saída'];
export function punchLabel(i: number) {
  if (i < 4) return PUNCH_LABELS[i];
  return i % 2 === 0 ? `Entrada extra ${i / 2 - 1}` : `Saída extra ${(i - 1) / 2 - 1}`;
}

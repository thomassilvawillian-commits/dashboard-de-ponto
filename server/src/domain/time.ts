/** Datas de calendário são strings 'AAAA-MM-DD'; instantes são Date (UTC). */

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string) {
  try { formatter(tz); return true; } catch { return false; }
}

export function zonedParts(d: Date, tz: string) {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(d)) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

export const pad = (n: number) => String(n).padStart(2, '0');

export function ymdIn(d: Date, tz: string) {
  const p = zonedParts(d, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function hmIn(d: Date, tz: string) {
  const p = zonedParts(d, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function minuteOfDay(d: Date, tz: string) {
  const p = zonedParts(d, tz);
  return p.hour * 60 + p.minute + p.second / 60;
}

export function parseHm(v: string | null | undefined): number | null {
  const m = String(v ?? '').match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Converte data e hora locais do fuso para o instante UTC correspondente. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const p = zonedParts(new Date(guess), tz);
    const diff = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - target;
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess);
}

export function isValidDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isValidMonth(s: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s) && Number(s.slice(0, 4)) >= 1900 && Number(s.slice(0, 4)) <= 2100;
}

export function addDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado */
export function weekday(date: string) {
  return new Date(date + 'T12:00:00Z').getUTCDay();
}

export function monthBounds(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${ym}-01`, last: `${ym}-${pad(last)}`, days: last };
}

export function minDate(...dates: (string | null | undefined)[]) {
  return dates.filter((d): d is string => !!d).sort()[0];
}

export function eachDay(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Feriados nacionais brasileiros (fixos + Sexta-feira Santa). */
export function brazilNationalHolidays(year: number) {
  const fixed: [string, string][] = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
    ['12-25', 'Natal'],
  ];
  const list = fixed.map(([md, name]) => ({ date: `${year}-${md}`, name }));
  list.push({ date: addDays(easter(year), -2), name: 'Sexta-feira Santa' });
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${pad(month)}-${pad(day)}`;
}

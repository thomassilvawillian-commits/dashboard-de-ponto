import type { DayStatus } from './types';

export function fmtMin(min: number, opts: { sign?: boolean } = {}) {
  const r = Math.round(min);
  const a = Math.abs(r);
  const s = `${Math.floor(a / 60)}h${String(a % 60).padStart(2, '0')}`;
  if (r < 0) return '−' + s;
  return opts.sign && r > 0 ? '+' + s : s;
}

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const fmtDate = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
export const fmtDayMonth = (d: string) => { const [, m, dd] = d.split('-'); return `${dd}/${m}`; };
export const fmtMonth = (ym: string) => { const [y, m] = ym.split('-').map(Number); const s = MONTHS[m - 1]; return `${s[0].toUpperCase()}${s.slice(1)} de ${y}`; };
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function hoursInput(min: number) { return (min / 60).toString().replace('.', ','); }
export function parseHours(v: string) {
  const s = v.trim().replace(',', '.');
  const hm = s.match(/^(-?)(\d{1,3}):([0-5]\d)$/);
  if (hm) return (hm[1] ? -1 : 1) * (Number(hm[2]) * 60 + Number(hm[3]));
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 60) : NaN;
}

export const STATUS: Record<DayStatus, { label: string; tone: 'good' | 'warn' | 'bad' | 'brand' | 'muted' }> = {
  completo: { label: 'Completo', tone: 'good' },
  em_andamento: { label: 'Em andamento', tone: 'brand' },
  incompleto: { label: 'Pendente', tone: 'warn' },
  falta: { label: 'Falta', tone: 'bad' },
  aguardando: { label: 'Aguardando', tone: 'muted' },
  folga: { label: 'Folga', tone: 'muted' },
  feriado: { label: 'Feriado', tone: 'muted' },
  ausencia: { label: 'Ausência abonada', tone: 'brand' },
  compensacao: { label: 'Compensação', tone: 'brand' },
  futuro: { label: '—', tone: 'muted' },
  fora_periodo: { label: 'Fora do período', tone: 'muted' },
};

export const ALERTS: Record<string, string> = {
  intervalo_insuficiente: 'Intervalo menor que 1h em jornada acima de 6h',
  jornada_excedida: 'Jornada acima de 10h no dia',
  interjornada: 'Menos de 11h de descanso desde o dia anterior',
  marcacao_impar: 'Número ímpar de marcações',
};

export const ROLE_LABEL = { ADMIN: 'Administrador', GESTOR: 'Gestor', FUNCIONARIO: 'Colaborador' } as const;

export const SOURCE_LABEL: Record<string, string> = { web: 'Registro', ajuste: 'Ajuste', importado: 'Importado' };

export function punchLabel(i: number) {
  return ['Entrada', 'Saída intervalo', 'Retorno', 'Saída'][i] ?? (i % 2 === 0 ? 'Entrada extra' : 'Saída extra');
}

export function downloadUrl(path: string) {
  const a = document.createElement('a');
  a.href = '/api' + path;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** plural(2, 'falta') → '2 faltas'; plural(1, 'dia pendente', 'dias pendentes') → '1 dia pendente' */
export function plural(n: number, one: string, many?: string) {
  return `${n} ${n === 1 ? one : many || one + 's'}`;
}

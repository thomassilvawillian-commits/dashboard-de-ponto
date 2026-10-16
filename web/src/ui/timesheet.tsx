import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { ALERTS, STATUS, WEEKDAYS, fmtDayMonth, fmtMin, fmtMonth, plural, shiftMonth } from '../format';
import type { Day, MonthSummary } from '../types';
import { Badge, Stat, cx } from './index';

export function MonthPicker({ value, onChange, max }: { value: string; onChange: (m: string) => void; max?: string }) {
  const next = shiftMonth(value, 1);
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
      <button className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2" onClick={() => onChange(shiftMonth(value, -1))} aria-label="Mês anterior"><ChevronLeft className="size-4" /></button>
      <span className="min-w-36 text-center text-sm font-medium">{fmtMonth(value)}</span>
      <button className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2 disabled:opacity-30" disabled={!!max && next > max} onClick={() => onChange(next)} aria-label="Próximo mês"><ChevronRight className="size-4" /></button>
    </div>
  );
}

export function SummaryStats({ s }: { s: MonthSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Trabalhado no mês" value={fmtMin(s.workedMin)} sub={`de ${fmtMin(s.expectedMin)} previstos até hoje`} />
      <Stat label="Saldo do mês" value={fmtMin(s.balanceMin, { sign: true })} tone={s.balanceMin > 0 ? 'good' : s.balanceMin < 0 ? 'bad' : undefined} sub={`${fmtMin(s.extraMin)} extras · ${fmtMin(s.missingMin)} faltantes`} />
      <Stat label="Banco de horas" value={fmtMin(s.bankMin, { sign: true })} tone={s.bankMin > 0 ? 'good' : s.bankMin < 0 ? 'bad' : undefined} sub="saldo acumulado" />
      <Stat label="Faltas" value={s.absences} sub={`${plural(s.lateDays, 'atraso')} · ${plural(s.pending, 'dia pendente', 'dias pendentes')}`} />
    </div>
  );
}

export function StatusBadge({ d }: { d: Day }) {
  const st = STATUS[d.status];
  return <Badge tone={st.tone}>{d.status === 'feriado' && d.holiday ? d.holiday : st.label}</Badge>;
}

/** Espelho de ponto: uma linha por dia, com marcações, totais e alertas. */
export function DayTable({ days, today, renderActions, onDayClick }: { days: Day[]; today: string; renderActions?: (d: Day) => ReactNode; onDayClick?: (d: Day) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-medium text-ink-3">
            <th className="px-4 py-2.5">Dia</th>
            <th className="px-2 py-2.5">Situação</th>
            <th className="px-2 py-2.5">Marcações</th>
            <th className="px-2 py-2.5 text-right">Previsto</th>
            <th className="px-2 py-2.5 text-right">Trabalhado</th>
            <th className="px-2 py-2.5 text-right">Saldo</th>
            {renderActions && <th className="no-print px-4 py-2.5" />}
          </tr>
        </thead>
        <tbody className="tabular">
          {days.filter((d) => d.status !== 'fora_periodo').map((d) => (
            <tr key={d.date} onClick={onDayClick ? () => onDayClick(d) : undefined}
              className={cx('border-b border-line last:border-0', d.date === today && 'bg-brand-soft/50', [0, 6].includes(d.weekday) && d.date !== today && 'bg-surface-2/40', onDayClick && 'cursor-pointer hover:bg-surface-2')}>
              <td className="whitespace-nowrap px-4 py-2.5"><span className="font-medium">{fmtDayMonth(d.date)}</span> <span className="text-ink-3">{WEEKDAYS[d.weekday]}</span></td>
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-1.5">
                  {d.status !== 'futuro' && <StatusBadge d={d} />}
                  {d.alerts.length > 0 && <span title={d.alerts.map((a) => ALERTS[a]).join('\n')} className="cursor-help text-xs font-medium text-warn-ink underline decoration-dotted">{d.alerts.length === 1 ? 'alerta' : `${d.alerts.length} alertas`}</span>}
                </div>
              </td>
              <td className="px-2 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {d.punches.map((p) => (
                    <span key={p.id} title={p.note || undefined} className={cx('rounded-md px-1.5 py-0.5 text-[13px]', p.source === 'web' ? 'bg-surface-2' : 'bg-warn-soft text-warn-ink')}>{p.time}</span>
                  ))}
                  {!d.punches.length && <span className="text-ink-3">—</span>}
                </div>
              </td>
              <td className="px-2 py-2.5 text-right text-ink-2">{d.expectedMin ? fmtMin(d.expectedMin) : '—'}</td>
              <td className="px-2 py-2.5 text-right">{d.workedMin ? fmtMin(d.workedMin) : '—'}</td>
              <td className={cx('px-2 py-2.5 text-right font-medium', d.balanceMin > 0 && 'text-good-ink', d.balanceMin < 0 && 'text-bad-ink')}>{d.balanceMin ? fmtMin(d.balanceMin, { sign: true }) : '—'}</td>
              {renderActions && <td className="no-print px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>{renderActions(d)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-ink-3">Marcações destacadas foram incluídas por ajuste ou importação. Passe o mouse sobre “alerta” para ver o motivo.</p>
    </div>
  );
}

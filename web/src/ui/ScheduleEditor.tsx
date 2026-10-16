import { WEEKDAYS, fmtMin } from '../format';
import { Field, Input, cx } from './index';

export interface ScheduleForm { dayMinutes: Record<string, number>; expectedStart: string; breakMinutes: number }
export const DEFAULT_SCHEDULE: ScheduleForm = { dayMinutes: { '0': 0, '1': 480, '2': 480, '3': 480, '4': 480, '5': 480, '6': 0 }, expectedStart: '09:00', breakMinutes: 60 };

const toHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHm = (v: string) => { const [h, m] = v.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

export function ScheduleEditor({ value, onChange }: { value: ScheduleForm; onChange: (v: ScheduleForm) => void }) {
  const total = Object.values(value.dayMinutes).reduce((a, b) => a + b, 0);
  const setDay = (d: string, m: number) => onChange({ ...value, dayMinutes: { ...value.dayMinutes, [d]: m } });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w, i) => {
          const k = String(i), m = value.dayMinutes[k] || 0;
          return (
            <div key={k} className={cx('flex flex-col items-center gap-1.5 rounded-lg border p-1.5', m ? 'border-brand bg-brand-soft/60' : 'border-line')}>
              <button type="button" onClick={() => setDay(k, m ? 0 : 480)} className={cx('w-full rounded-md py-1 text-xs font-semibold', m ? 'text-brand-strong' : 'text-ink-3')} aria-pressed={!!m}>{w}</button>
              <input type="time" aria-label={`Horas em ${w}`} value={toHm(m)} onChange={(e) => setDay(k, fromHm(e.target.value))}
                className="w-full min-w-0 rounded-md border border-line bg-surface px-0.5 py-1 text-center text-xs tabular [&::-webkit-calendar-picker-indicator]:hidden" />
            </div>
          );
        })}
      </div>
      <p className="-mt-2 text-xs text-ink-3">Clique no dia para ativar ou desativar. O horário indica as horas de trabalho previstas no dia. Total semanal: <b className="tabular">{fmtMin(total)}</b>.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entrada prevista" hint="Usada para apurar atrasos">{(id) => <Input id={id} type="time" value={value.expectedStart} onChange={(e) => onChange({ ...value, expectedStart: e.target.value })} />}</Field>
        <Field label="Intervalo (minutos)">{(id) => <Input id={id} type="number" min={0} max={600} value={value.breakMinutes} onChange={(e) => onChange({ ...value, breakMinutes: Number(e.target.value) })} />}</Field>
      </div>
    </div>
  );
}

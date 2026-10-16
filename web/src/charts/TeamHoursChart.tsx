import { useState } from 'react';
import { WEEKDAYS, fmtDayMonth, fmtMin } from '../format';

interface Point { date: string; workedMin: number; expectedMin: number }

/** Horas da equipe por dia: barras de horas trabalhadas e um traço com as horas previstas em cada dia (mesma escala). */
export function TeamHoursChart({ series, today }: { series: Point[]; today: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760, H = 220, padL = 44, padR = 8, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(60, ...series.map((p) => Math.max(p.workedMin, p.expectedMin))) * 1.1;
  const step = plotW / series.length, bw = Math.max(3, Math.min(16, step - 3));
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const tickStep = Math.max(60, Math.ceil(max / 4 / 60) * 60);
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += tickStep) ticks.push(t);
  const h = hover != null ? series[hover] : null;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: 'var(--series-1)' }} />Horas trabalhadas</span>
        <span className="flex items-center gap-1.5"><svg width="14" height="4" aria-hidden><line x1="0" x2="14" y1="2" y2="2" stroke="var(--ink-2)" strokeWidth="2" strokeDasharray="3 2" /></svg>Horas previstas no dia</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Horas trabalhadas e previstas da equipe por dia" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--line-strong)' : 'var(--grid)'} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--ink-3)">{Math.round(t / 60)}h</text>
          </g>
        ))}
        {series.map((p, i) => {
          const x = padL + i * step + (step - bw) / 2;
          const top = y(p.workedMin), hgt = padT + plotH - top, r = Math.min(4, bw / 2, hgt);
          const showLabel = i === 0 || i === series.length - 1 || Number(p.date.slice(8)) % 5 === 0;
          return (
            <g key={p.date}>
              {hgt > 0 && <path d={`M${x},${padT + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${padT + plotH} Z`}
                fill="var(--series-1)" opacity={hover == null || hover === i ? 1 : 0.45} />}
              {p.date <= today && p.expectedMin > 0 && <line x1={x - 2} x2={x + bw + 2} y1={y(p.expectedMin)} y2={y(p.expectedMin)} stroke="var(--ink-2)" strokeWidth={2} strokeDasharray="3 2" pointerEvents="none" />}
              {showLabel && <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--ink-3)">{p.date.slice(8)}</text>}
              <rect x={padL + i * step} y={padT} width={step} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-6 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `clamp(0px, calc(${((padL + hover! * step + step / 2) / W) * 100}% - 75px), calc(100% - 160px))` }}>
          <p className="font-medium">{WEEKDAYS[new Date(h.date + 'T12:00:00Z').getUTCDay()]}, {fmtDayMonth(h.date)}</p>
          <p className="text-ink-2">Trabalhadas: <span className="tabular text-ink">{fmtMin(h.workedMin)}</span></p>
          <p className="text-ink-2">Previstas: <span className="tabular text-ink">{fmtMin(h.expectedMin)}</span></p>
        </div>
      )}
    </div>
  );
}

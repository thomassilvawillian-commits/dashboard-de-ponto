import { useState } from 'react';
import { WEEKDAYS, fmtDayMonth, fmtMin } from '../format';
import type { Day } from '../types';

/** Saldo diário em barras divergentes: azul acima de zero (crédito), vermelho abaixo (débito). */
export function BalanceChart({ days, height = 180 }: { days: Day[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = days.filter((d) => d.status !== 'fora_periodo');
  if (!data.length) return null;
  const max = Math.max(60, ...data.map((d) => Math.abs(d.balanceMin)));
  const W = 720, H = height, padL = 44, padR = 8, padT = 10, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB, mid = padT + plotH / 2;
  const step = plotW / data.length, bw = Math.max(3, Math.min(18, step - 2));
  const y = (v: number) => (v / max) * (plotH / 2);
  const ticks = [max, max / 2, 0, -max / 2, -max];
  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Saldo diário de horas no mês" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={mid - y(t)} y2={mid - y(t)} stroke={t === 0 ? 'var(--line-strong)' : 'var(--grid)'} strokeWidth={1} />
            <text x={padL - 6} y={mid - y(t) + 4} textAnchor="end" fontSize={10} fill="var(--ink-3)" className="tabular">{t === 0 ? '0' : fmtMin(t, { sign: true })}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * step + (step - bw) / 2;
          const v = d.balanceMin, hgt = Math.max(v ? 2 : 0, Math.abs(y(v)));
          const r = Math.min(4, bw / 2, hgt);
          const path = v >= 0
            ? `M${x},${mid} V${mid - hgt + r} Q${x},${mid - hgt} ${x + r},${mid - hgt} H${x + bw - r} Q${x + bw},${mid - hgt} ${x + bw},${mid - hgt + r} V${mid} Z`
            : `M${x},${mid} V${mid + hgt - r} Q${x},${mid + hgt} ${x + r},${mid + hgt} H${x + bw - r} Q${x + bw},${mid + hgt} ${x + bw},${mid + hgt - r} V${mid} Z`;
          const showLabel = i === 0 || i === data.length - 1 || Number(d.date.slice(8)) % 5 === 0;
          return (
            <g key={d.date}>
              {hgt > 0 && <path d={path} fill={v >= 0 ? 'var(--series-1)' : 'var(--neg)'} opacity={hover == null || hover === i ? 1 : 0.45} />}
              {showLabel && <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--ink-3)">{d.date.slice(8)}</text>}
              <rect x={padL + i * step} y={padT} width={step} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `clamp(0px, calc(${((padL + hover! * step + step / 2) / W) * 100}% - 70px), calc(100% - 150px))` }}>
          <p className="font-medium">{WEEKDAYS[h.weekday]}, {fmtDayMonth(h.date)}</p>
          <p className="text-ink-2">Trabalhado: <span className="tabular text-ink">{fmtMin(h.workedMin)}</span></p>
          <p className="text-ink-2">Saldo: <span className="tabular text-ink">{fmtMin(h.balanceMin, { sign: true })}</span></p>
        </div>
      )}
    </div>
  );
}

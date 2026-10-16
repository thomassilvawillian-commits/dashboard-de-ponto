import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { get, post } from '../api';
import { useAuth } from '../auth';
import { ALERTS, WEEKDAYS_LONG, fmtDate, fmtMin, punchLabel } from '../format';
import type { Day, Schedule } from '../types';
import { Button, Card, ErrorBox, Spinner, cx, useLoad, useToast } from '../ui';
import { RequestModal } from '../ui/RequestModal';
import { StatusBadge } from '../ui/timesheet';

interface Today {
  now: string; today: string; timezone: string; day: Day; bankMin: number; schedule: Schedule | null;
  next: { index: number; label: string; isEntry: boolean };
}

function useServerClock(serverNow?: string) {
  const offset = useMemo(() => (serverNow ? new Date(serverNow).getTime() - Date.now() : 0), [serverNow]);
  const [now, setNow] = useState(() => new Date(Date.now() + offset));
  useEffect(() => {
    setNow(new Date(Date.now() + offset));
    const t = setInterval(() => setNow(new Date(Date.now() + offset)), 1000);
    return () => clearInterval(t);
  }, [offset]);
  return now;
}

const ACTION: Record<string, string> = {
  Entrada: 'Registrar entrada',
  'Saída para intervalo': 'Registrar saída para o intervalo',
  'Retorno do intervalo': 'Registrar volta do intervalo',
  Saída: 'Registrar saída',
};

export default function Punch() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad<Today>(() => get('/me/today'), []);
  const now = useServerClock(data?.now);
  const [busy, setBusy] = useState(false);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(reload, 60_000);
    const vis = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox error={error} />;
  if (!data) return null;

  const tz = data.timezone;
  const time = now.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const weekday = WEEKDAYS_LONG[new Date(data.today + 'T12:00:00Z').getUTCDay()].toLowerCase();
  const d = data.day;
  const rows = Math.max(4, d.punches.length + (d.punches.length % 2));

  async function punch() {
    setBusy(true);
    setPunchError(null);
    try {
      const r = await post('/me/punch');
      toast(`${r.punch.label} registrada às ${new Date(r.punch.ts).toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })}.`);
      reload();
    } catch (e: any) {
      setPunchError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-b border-line pb-4">
        <h1 className="text-xl font-semibold">Registro de ponto</h1>
        <p className="mt-1 text-sm text-ink-2">{user?.name} · {weekday}, {fmtDate(data.today)}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <div className="card p-5">
            <p className="text-sm text-ink-2">Horário atual</p>
            <p className="tabular text-5xl font-semibold">{time}</p>
            <Button variant="primary" size="lg" className="mt-5 h-14 w-full text-base" loading={busy} onClick={punch}>
              {ACTION[data.next.label] || `Registrar ${data.next.label.toLowerCase()}`}
            </Button>
            {punchError && <div className="mt-3"><ErrorBox error={punchError} /></div>}
            <p className="mt-3 text-xs text-ink-3">O horário gravado é o do servidor no momento do clique.</p>
          </div>

          <Card title="Marcações de hoje" actions={<StatusBadge d={d} />} pad={false}>
            <table className="w-full text-sm">
              <tbody className="tabular">
                {Array.from({ length: rows }, (_, i) => {
                  const p = d.punches[i];
                  return (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-4 py-2 text-ink-2">{punchLabel(i)}</td>
                      <td className={cx('px-4 py-2 text-right font-medium', !p && 'text-ink-3')}>{p ? p.time : '--:--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <p className="text-sm">
            Esqueceu de registrar ou registrou errado?{' '}
            <button className="font-medium text-brand underline underline-offset-2" onClick={() => setRequestOpen(true)}>Solicitar ajuste</button>
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Resumo do dia" pad={false}>
            <dl className="text-sm">
              {[
                ['Trabalhado hoje', fmtMin(d.workedMin)],
                ['Jornada do dia', d.expectedMin ? fmtMin(d.expectedMin) : 'Sem jornada'],
                ['Entrada prevista', data.schedule?.expectedStart || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-line px-4 py-2 last:border-0"><dt className="text-ink-2">{k}</dt><dd className="tabular font-medium">{v}</dd></div>
              ))}
              <div className="flex justify-between px-4 py-2">
                <dt className="text-ink-2">Banco de horas</dt>
                <dd className={cx('tabular font-semibold', data.bankMin > 0 && 'text-good-ink', data.bankMin < 0 && 'text-bad-ink')}>{fmtMin(data.bankMin, { sign: true })}</dd>
              </div>
            </dl>
          </Card>
          {d.alerts.length > 0 && (
            <div className="rounded border border-warn/50 bg-warn-soft px-4 py-3 text-sm text-warn-ink">{d.alerts.map((a) => <p key={a}>{ALERTS[a]}</p>)}</div>
          )}
          <Link to="/espelho" className="text-sm font-medium text-brand underline underline-offset-2">Ver o espelho do mês</Link>
        </div>
      </div>
      <RequestModal open={requestOpen} onClose={() => setRequestOpen(false)} day={d} today={data.today} onDone={reload} />
    </div>
  );
}

import { CalendarClock, Coffee, Fingerprint, History, LogIn, LogOut, MapPin, PiggyBank, Timer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { get, post } from '../api';
import { useAuth } from '../auth';
import { ALERTS, WEEKDAYS_LONG, fmtMin, punchLabel } from '../format';
import type { Day, Schedule } from '../types';
import { Badge, Button, Card, ErrorBox, Spinner, cx, useLoad, useToast } from '../ui';
import { RequestModal } from '../ui/RequestModal';
import { StatusBadge } from '../ui/timesheet';

interface Today {
  now: string; today: string; timezone: string; day: Day; bankMin: number; schedule: Schedule | null;
  next: { index: number; label: string; isEntry: boolean }; requestGeolocation: boolean;
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

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 });
  });
}

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
  const dateLabel = now.toLocaleDateString('pt-BR', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' });
  const weekday = WEEKDAYS_LONG[new Date(data.today + 'T12:00:00Z').getUTCDay()];
  const hour = Number(now.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }));
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const d = data.day;
  const progress = d.expectedMin ? Math.min(100, (d.workedMin / d.expectedMin) * 100) : 0;
  const slots = Math.max(4, d.punches.length + (d.punches.length % 2));

  async function punch() {
    setBusy(true);
    setPunchError(null);
    try {
      let geo: GeolocationPosition | null = null;
      if (data!.requestGeolocation) geo = await getPosition();
      const r = await post('/me/punch', geo ? { latitude: geo.coords.latitude, longitude: geo.coords.longitude, accuracy: geo.coords.accuracy } : {});
      toast(`${r.punch.label} registrada às ${new Date(r.punch.ts).toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })}.`);
      if (navigator.vibrate) navigator.vibrate(60);
      reload();
    } catch (e: any) {
      setPunchError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const NextIcon = data.next.index === 0 ? LogIn : data.next.index === 1 ? Coffee : data.next.isEntry ? LogIn : LogOut;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting}, {user?.name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-ink-2">{weekday}, {dateLabel}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card flex flex-col items-center gap-6 p-6 text-center sm:p-10 lg:col-span-3">
          <div>
            <p className="text-6xl font-semibold tracking-tight tabular sm:text-7xl" aria-live="off">{time}</p>
            <p className="mt-2 text-sm text-ink-3">Horário oficial do servidor · {tz.replace('_', ' ')}</p>
          </div>
          <button onClick={punch} disabled={busy}
            className={cx('group relative grid size-44 place-items-center rounded-full text-on-brand shadow-xl transition-transform active:scale-95 disabled:opacity-70 sm:size-52',
              data.next.isEntry ? 'bg-brand hover:bg-brand-strong' : 'bg-[#127a55] hover:bg-[#0e6446]')}>
            <span className="absolute inset-0 rounded-full ring-8 ring-brand/15 transition group-hover:ring-[12px]" />
            <span className="flex flex-col items-center gap-2">
              {busy ? <Fingerprint className="size-12 animate-pulse" /> : <NextIcon className="size-12" />}
              <span className="text-lg font-semibold">Registrar</span>
              <span className="text-sm opacity-90">{data.next.label}</span>
            </span>
          </button>
          <ErrorBox error={punchError} />
          {data.requestGeolocation && <p className="flex items-center gap-1.5 text-xs text-ink-3"><MapPin className="size-3.5" />A localização é registrada junto com a marcação, se você permitir.</p>}
          <Button variant="ghost" size="sm" onClick={() => setRequestOpen(true)}><History className="size-4" />Esqueci de registrar um horário</Button>
        </section>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card title="Hoje" actions={<StatusBadge d={d} />}>
            <ol className="flex flex-col">
              {Array.from({ length: slots }, (_, i) => {
                const p = d.punches[i];
                return (
                  <li key={i} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                    <span className={cx('grid size-8 place-items-center rounded-full text-xs font-semibold', p ? 'bg-brand text-on-brand' : 'border border-dashed border-line-strong text-ink-3')}>{i + 1}</span>
                    <span className="flex-1 text-sm text-ink-2">{punchLabel(i)}</span>
                    <span className={cx('tabular text-sm font-medium', !p && 'text-ink-3')}>{p ? p.time : i === d.punches.length ? 'próxima' : '—'}</span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-ink-2">
                <span>Trabalhado: <b className="tabular text-ink">{fmtMin(d.workedMin)}</b></span>
                <span>Jornada: <b className="tabular text-ink">{d.expectedMin ? fmtMin(d.expectedMin) : 'livre'}</b></span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            {d.alerts.length > 0 && (
              <div className="mt-4 flex flex-col gap-1">{d.alerts.map((a) => <Badge key={a} tone="warn">{ALERTS[a]}</Badge>)}</div>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="flex items-center gap-1.5 text-[13px] text-ink-2"><PiggyBank className="size-4" />Banco de horas</p>
              <p className={cx('mt-1 text-2xl font-semibold tabular', data.bankMin > 0 && 'text-good-ink', data.bankMin < 0 && 'text-bad-ink')}>{fmtMin(data.bankMin, { sign: true })}</p>
            </div>
            <div className="card p-4">
              <p className="flex items-center gap-1.5 text-[13px] text-ink-2"><CalendarClock className="size-4" />Entrada prevista</p>
              <p className="mt-1 text-2xl font-semibold tabular">{data.schedule?.expectedStart || '—'}</p>
            </div>
          </div>
          <Link to="/espelho" className="card flex items-center justify-between p-4 text-sm font-medium hover:bg-surface-2">
            <span className="flex items-center gap-2"><Timer className="size-4 text-brand" />Ver meu espelho de ponto do mês</span><span aria-hidden>→</span>
          </Link>
        </div>
      </div>
      <RequestModal open={requestOpen} onClose={() => setRequestOpen(false)} day={d} today={data.today} onDone={reload} />
    </div>
  );
}

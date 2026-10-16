import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckSquare, Clock, Coffee, Download, Search, UserCheck, UserX, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { get } from '../../api';
import { TeamHoursChart } from '../../charts/TeamHoursChart';
import { downloadUrl, fmtMin, fmtMonth } from '../../format';
import { Badge, Button, Card, Empty, ErrorBox, Input, PageHeader, Select, Spinner, Stat, cx, useLoad } from '../../ui';
import { MonthPicker } from '../../ui/timesheet';

interface Member {
  id: number; name: string; role: string; active: boolean; department: string | null; jobTitle: string | null; trackTime: boolean;
  month: { workedMin: number; expectedMin: number; extraMin: number; missingMin: number; balanceMin: number; bankMin: number; absences: number; lateDays: number; lateMin: number; pending: number; daysWorked: number };
  today: { presence: string; status: string; workedMin: number; expectedMin: number; lateMin: number; lastPunch: { time: string; label: string } | null; punches: number };
  alerts: { date: string; alert: string }[];
}
interface Overview {
  month: string; today: string; now: string;
  kpis: Record<string, number>;
  presence: Record<string, number>;
  series: { date: string; workedMin: number; expectedMin: number }[];
  team: Member[];
}

export const PRESENCE: Record<string, { label: string; tone: 'good' | 'warn' | 'bad' | 'brand' | 'muted'; icon: ReactNode }> = {
  trabalhando: { label: 'Trabalhando', tone: 'good', icon: <UserCheck className="size-3.5" /> },
  intervalo: { label: 'Em intervalo', tone: 'warn', icon: <Coffee className="size-3.5" /> },
  encerrado: { label: 'Jornada encerrada', tone: 'brand', icon: <CheckSquare className="size-3.5" /> },
  nao_chegou: { label: 'Sem registro', tone: 'bad', icon: <UserX className="size-3.5" /> },
  ausencia: { label: 'Ausência', tone: 'muted', icon: null },
  folga: { label: 'Folga', tone: 'muted', icon: null },
  feriado: { label: 'Feriado', tone: 'muted', icon: null },
};

export default function Dashboard() {
  const nav = useNavigate();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ativos');
  const { data, error, loading } = useLoad<Overview>(() => get(`/admin/overview?m=${month}`), [month]);

  const team = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.team.filter((t) => {
      if (term && !`${t.name} ${t.department || ''}`.toLowerCase().includes(term)) return false;
      if (filter === 'ativos') return t.active && t.trackTime;
      if (filter === 'inativos') return !t.active;
      if (filter === 'pendencias') return t.month.pending > 0 || t.alerts.length > 0;
      if (filter === 'negativos') return t.month.bankMin < 0;
      return true;
    });
  }, [data, q, filter]);

  const isCurrent = data && month === data.today.slice(0, 7);
  const k = data?.kpis;

  return (
    <>
      <PageHeader title="Painel de gestão" subtitle={<span>{fmtMonth(month)}</span>}
        actions={<>
          <MonthPicker value={month} onChange={setMonth} max={data?.today.slice(0, 7)} />
          <Button onClick={() => downloadUrl(`/admin/reports/summary.csv?m=${month}`)}><Download className="size-4" />Resumo CSV</Button>
        </>} />
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data && k && (
        <div className="flex flex-col gap-6">
          {isCurrent && (
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(['trabalhando', 'intervalo', 'encerrado', 'nao_chegou'] as const).map((p) => (
                <div key={p} className="card flex items-center gap-3 p-4">
                  <div className={cx('grid size-10 place-items-center rounded-xl', { trabalhando: 'bg-good-soft text-good-ink', intervalo: 'bg-warn-soft text-warn-ink', encerrado: 'bg-brand-soft text-brand-strong', nao_chegou: 'bg-bad-soft text-bad-ink' }[p])}>
                    {{ trabalhando: <UserCheck className="size-5" />, intervalo: <Coffee className="size-5" />, encerrado: <CheckSquare className="size-5" />, nao_chegou: <UserX className="size-5" /> }[p]}
                  </div>
                  <div>
                    <p className="text-2xl font-semibold leading-none">{data.presence[p] || 0}</p>
                    <p className="mt-1 text-xs text-ink-2">{PRESENCE[p].label} agora</p>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat icon={<Users className="size-4" />} label="Colaboradores" value={k.people} sub="com controle de jornada" />
            <Stat icon={<Clock className="size-4" />} label="Horas trabalhadas" value={fmtMin(k.workedMin)} sub={`${k.expectedMin ? Math.round((k.workedMin / k.expectedMin) * 100) : 0}% do previsto até hoje`} />
            <Stat icon={<ArrowUpRight className="size-4" />} label="Horas extras" value={fmtMin(k.extraMin)} tone={k.extraMin ? 'good' : undefined} />
            <Stat icon={<ArrowDownRight className="size-4" />} label="Horas faltantes" value={fmtMin(k.missingMin)} tone={k.missingMin ? 'bad' : undefined} sub={`${k.absences} falta(s) · ${k.lateDays} atraso(s)`} />
            <Stat label="Banco da equipe" value={fmtMin(k.bankMin, { sign: true })} tone={k.bankMin > 0 ? 'good' : k.bankMin < 0 ? 'bad' : undefined} sub="saldo acumulado somado" />
            <Link to="/gestao/aprovacoes" className="card flex flex-col gap-1 p-4 hover:bg-surface-2">
              <span className="flex items-center gap-2 text-[13px] text-ink-2"><AlertTriangle className="size-4" />Requer atenção</span>
              <span className="text-2xl font-semibold">{k.pendingRequests}</span>
              <span className="text-xs text-ink-3">solicitação(ões) · {k.pendingDays} dia(s) pendente(s) · {k.alerts} alerta(s)</span>
            </Link>
          </section>

          <Card title="Horas da equipe por dia">
            <TeamHoursChart series={data.series} today={data.today} />
          </Card>

          <Card pad={false} title="Equipe" actions={<>
            <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" /><Input className="h-9 w-52 pl-8" placeholder="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar colaborador" /></div>
            <Select className="h-9 w-auto" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtro">
              <option value="ativos">Ativos com jornada</option><option value="todos">Todos</option><option value="pendencias">Com pendências ou alertas</option>
              <option value="negativos">Banco negativo</option><option value="inativos">Inativos</option>
            </Select>
          </>}>
            {!team.length ? <Empty title="Ninguém encontrado">Ajuste a busca ou o filtro.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium text-ink-3">
                      <th className="px-5 py-2.5">Colaborador</th>
                      {isCurrent && <th className="px-2 py-2.5">Agora</th>}
                      <th className="px-2 py-2.5 text-right">Trabalhado</th>
                      <th className="px-2 py-2.5 text-right">Extras</th>
                      <th className="px-2 py-2.5 text-right">Faltantes</th>
                      <th className="px-2 py-2.5 text-right">Saldo mês</th>
                      <th className="px-2 py-2.5 text-right">Banco</th>
                      <th className="px-5 py-2.5">Ocorrências</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {team.map((t) => {
                      const pr = PRESENCE[t.today.presence];
                      return (
                        <tr key={t.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2" onClick={() => nav(`/gestao/colaboradores/${t.id}?m=${month}`)}>
                          <td className="px-5 py-3">
                            <p className="font-medium">{t.name}{!t.active && <span className="ml-2"><Badge>Inativo</Badge></span>}</p>
                            <p className="text-xs text-ink-3">{[t.jobTitle, t.department].filter(Boolean).join(' · ') || '—'}</p>
                          </td>
                          {isCurrent && (
                            <td className="px-2 py-3">
                              {t.trackTime && t.active ? <Badge tone={pr.tone} icon={pr.icon}>{pr.label}</Badge> : <span className="text-ink-3">—</span>}
                              {t.today.lastPunch && <p className="mt-0.5 text-xs text-ink-3">{t.today.lastPunch.label} às {t.today.lastPunch.time}</p>}
                            </td>
                          )}
                          <td className="px-2 py-3 text-right">{fmtMin(t.month.workedMin)}</td>
                          <td className="px-2 py-3 text-right text-good-ink">{t.month.extraMin ? fmtMin(t.month.extraMin) : '—'}</td>
                          <td className="px-2 py-3 text-right text-bad-ink">{t.month.missingMin ? fmtMin(t.month.missingMin) : '—'}</td>
                          <td className={cx('px-2 py-3 text-right font-medium', t.month.balanceMin > 0 && 'text-good-ink', t.month.balanceMin < 0 && 'text-bad-ink')}>{fmtMin(t.month.balanceMin, { sign: true })}</td>
                          <td className={cx('px-2 py-3 text-right font-semibold', t.month.bankMin > 0 && 'text-good-ink', t.month.bankMin < 0 && 'text-bad-ink')}>{fmtMin(t.month.bankMin, { sign: true })}</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {t.month.absences > 0 && <Badge tone="bad">{t.month.absences} falta(s)</Badge>}
                              {t.month.lateDays > 0 && <Badge tone="warn">{t.month.lateDays} atraso(s)</Badge>}
                              {t.month.pending > 0 && <Badge tone="warn">{t.month.pending} pendente(s)</Badge>}
                              {t.alerts.length > 0 && <Badge tone="warn" icon={<AlertTriangle className="size-3" />}>{t.alerts.length}</Badge>}
                              {!t.month.absences && !t.month.lateDays && !t.month.pending && !t.alerts.length && <span className="text-ink-3">—</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

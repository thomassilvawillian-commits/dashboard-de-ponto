import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { get } from '../../api';
import { downloadUrl, fmtMin, fmtMonth, plural } from '../../format';
import { Badge, Button, Card, Empty, ErrorBox, Input, PageHeader, Select, Spinner, cx, useLoad } from '../../ui';
import { MonthPicker } from '../../ui/timesheet';

interface Member {
  id: number; name: string; active: boolean; department: string | null; jobTitle: string | null; trackTime: boolean;
  month: { workedMin: number; balanceMin: number; bankMin: number; absences: number; lateDays: number; pending: number };
  today: { presence: string; lastPunch: { time: string; label: string } | null };
}
interface Overview { month: string; today: string; kpis: Record<string, number>; presence: Record<string, number>; team: Member[] }

export const PRESENCE: Record<string, { label: string; tone: 'good' | 'warn' | 'bad' | 'brand' | 'muted' }> = {
  trabalhando: { label: 'Trabalhando', tone: 'good' },
  intervalo: { label: 'Em intervalo', tone: 'warn' },
  encerrado: { label: 'Encerrou o dia', tone: 'brand' },
  nao_chegou: { label: 'Sem registro', tone: 'bad' },
  ausencia: { label: 'Ausência', tone: 'muted' },
  folga: { label: 'Folga', tone: 'muted' },
  feriado: { label: 'Feriado', tone: 'muted' },
};

export default function Dashboard() {
  const nav = useNavigate();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [q, setQ] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const { data, error, loading } = useLoad<Overview>(() => get(`/admin/overview?m=${month}`), [month]);

  const team = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.team || []).filter((t) => t.active && t.trackTime
      && (!term || t.name.toLowerCase().includes(term))
      && (!onlyIssues || t.month.absences > 0 || t.month.pending > 0 || t.month.bankMin < 0));
  }, [data, q, onlyIssues]);

  const isCurrent = !!data && month === data.today.slice(0, 7);

  return (
    <>
      <PageHeader title="Painel" subtitle={fmtMonth(month)}
        actions={<>
          <MonthPicker value={month} onChange={setMonth} max={data?.today.slice(0, 7)} />
          <Button onClick={() => downloadUrl(`/admin/reports/summary.csv?m=${month}`)}>Baixar resumo</Button>
        </>} />
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data && (
        <div className="flex flex-col gap-4">
          {data.kpis.pendingRequests > 0 && (
            <Link to="/gestao/aprovacoes" className="rounded border border-warn/50 bg-warn-soft px-4 py-2.5 text-sm font-medium text-warn-ink underline-offset-2 hover:underline">
              {data.kpis.pendingRequests === 1 ? '1 solicitação de ajuste aguardando aprovação' : `${data.kpis.pendingRequests} solicitações de ajuste aguardando aprovação`}
            </Link>
          )}
          {isCurrent && (
            <p className="text-sm text-ink-2">
              Agora: {(['trabalhando', 'intervalo', 'encerrado', 'nao_chegou'] as const).map((p) => `${data.presence[p] || 0} ${PRESENCE[p].label.toLowerCase()}`).join(' · ')}
            </p>
          )}

          <Card pad={false} title="Equipe" actions={<>
            <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" /><Input className="h-9 w-52 pl-8" placeholder="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar colaborador" /></div>
            <Select className="h-9 w-auto" value={onlyIssues ? '1' : ''} onChange={(e) => setOnlyIssues(!!e.target.value)} aria-label="Filtro">
              <option value="">Todos</option><option value="1">Só com faltas, pendências ou banco negativo</option>
            </Select>
          </>}>
            {!team.length ? <Empty title="Ninguém encontrado">Cadastre colaboradores em “Colaboradores” ou ajuste a busca.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium text-ink-3">
                      <th className="px-5 py-2.5">Colaborador</th>
                      {isCurrent && <th className="px-2 py-2.5">Hoje</th>}
                      <th className="px-2 py-2.5 text-right">Trabalhado</th>
                      <th className="px-2 py-2.5 text-right">Saldo do mês</th>
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
                            <p className="font-medium">{t.name}</p>
                            <p className="text-xs text-ink-3">{[t.jobTitle, t.department].filter(Boolean).join(' · ') || '—'}</p>
                          </td>
                          {isCurrent && (
                            <td className="px-2 py-3">
                              <Badge tone={pr.tone}>{pr.label}</Badge>
                              {t.today.lastPunch && <p className="mt-0.5 text-xs text-ink-3">{t.today.lastPunch.label} às {t.today.lastPunch.time}</p>}
                            </td>
                          )}
                          <td className="px-2 py-3 text-right">{fmtMin(t.month.workedMin)}</td>
                          <td className={cx('px-2 py-3 text-right', t.month.balanceMin > 0 && 'text-good-ink', t.month.balanceMin < 0 && 'text-bad-ink')}>{fmtMin(t.month.balanceMin, { sign: true })}</td>
                          <td className={cx('px-2 py-3 text-right font-semibold', t.month.bankMin > 0 && 'text-good-ink', t.month.bankMin < 0 && 'text-bad-ink')}>{fmtMin(t.month.bankMin, { sign: true })}</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap gap-1">
                              {t.month.absences > 0 && <Badge tone="bad">{plural(t.month.absences, 'falta')}</Badge>}
                              {t.month.lateDays > 0 && <Badge tone="warn">{plural(t.month.lateDays, 'atraso')}</Badge>}
                              {t.month.pending > 0 && <Badge tone="warn">{plural(t.month.pending, 'dia pendente', 'dias pendentes')}</Badge>}
                              {!t.month.absences && !t.month.lateDays && !t.month.pending && <span className="text-ink-3">—</span>}
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

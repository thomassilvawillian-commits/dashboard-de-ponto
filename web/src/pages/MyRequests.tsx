import { useState } from 'react';
import { del, get, post } from '../api';
import { fmtDate, fmtDateTime } from '../format';
import type { PunchRequest } from '../types';
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, Spinner, useLoad, useToast } from '../ui';
import { JUSTIFICATION_TYPES, JustifyModal } from '../ui/JustifyModal';
import { RequestModal } from '../ui/RequestModal';

export const REQUEST_STATUS = {
  PENDENTE: { label: 'Pendente', tone: 'warn' }, APROVADO: { label: 'Aprovada', tone: 'good' },
  REJEITADO: { label: 'Recusada', tone: 'bad' }, CANCELADO: { label: 'Cancelada', tone: 'muted' },
} as const;

export default function MyRequests() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad<{ requests: PunchRequest[] }>(() => get('/me/requests'), []);
  const today = useLoad<{ today: string }>(() => get('/me/today'), []);
  const [open, setOpen] = useState(false);
  const absences = useLoad<{ absences: { id: number; startDate: string; endDate: string; type: string; note: string | null; mine: boolean }[] }>(() => get('/me/absences'), []);
  const [justify, setJustify] = useState<string | null>(null);

  async function removeJustification(id: number) {
    if (!confirm('Remover esta justificativa? O dia volta a contar como falta.')) return;
    try { await del(`/me/absences/${id}`); toast('Justificativa removida.'); absences.reload(); } catch (e: any) { toast(e.message, 'bad'); }
  }

  async function cancel(id: number) {
    try { await post(`/me/requests/${id}/cancel`); toast('Solicitação cancelada.'); reload(); } catch (e: any) { toast(e.message, 'bad'); }
  }

  return (
    <>
      <PageHeader title="Minhas solicitações" subtitle="Ajustes de horário passam pela aprovação do RH. Justificativas de falta valem na hora." />
      <ErrorBox error={error} />
      <Card pad={false} className="mb-5" title="Ajustes de horário" actions={<Button size="sm" variant="primary" onClick={() => setOpen(true)}>Novo ajuste</Button>}>
        {loading && !data ? <Spinner /> : !data?.requests.length ? (
          <Empty title="Nenhum ajuste solicitado">Use “Novo ajuste” para incluir um horário esquecido ou corrigir uma marcação.</Empty>
        ) : (
          <ul>
            {data.requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.kind === 'ADD' ? 'Incluir' : 'Desconsiderar'} marcação de <span className="tabular">{r.time}</span> em {fmtDate(r.date)}</p>
                  <p className="text-sm text-ink-2">{r.reason}</p>
                  <p className="mt-1 text-xs text-ink-3">Enviada em {fmtDateTime(r.createdAt)}{r.decidedBy ? ` · decidida por ${r.decidedBy}` : ''}{r.decisionNote ? ` · “${r.decisionNote}”` : ''}</p>
                </div>
                <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                {r.status === 'PENDENTE' && <Button size="sm" variant="ghost" onClick={() => cancel(r.id)}>Cancelar</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card pad={false} title="Faltas justificadas" actions={<Button size="sm" onClick={() => setJustify(today.data?.today || '')} disabled={!today.data}>Justificar falta</Button>}>
        {absences.loading && !absences.data ? <Spinner /> : !absences.data?.absences.length ? (
          <Empty title="Nenhuma falta justificada">Se faltou por atestado, consulta ou outro motivo, justifique aqui ou pelo botão “Justificar” no espelho.</Empty>
        ) : (
          <ul>
            {absences.data.absences.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{fmtDate(a.startDate)}{a.endDate !== a.startDate ? ` a ${fmtDate(a.endDate)}` : ''} · {JUSTIFICATION_TYPES[a.type] || a.type}</p>
                  {a.note && <p className="text-sm text-ink-2">{a.note}</p>}
                  {!a.mine && <p className="text-xs text-ink-3">Registrada pelo RH</p>}
                </div>
                {a.mine && <Button size="sm" variant="ghost" onClick={() => removeJustification(a.id)}>Remover</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <JustifyModal date={justify} today={today.data?.today || ''} onClose={() => setJustify(null)} onDone={absences.reload} />
      <RequestModal open={open} onClose={() => setOpen(false)} today={today.data?.today || new Date().toISOString().slice(0, 10)} onDone={reload} />
    </>
  );
}

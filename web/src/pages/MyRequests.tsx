import { ClipboardList, Plus } from 'lucide-react';
import { useState } from 'react';
import { get, post } from '../api';
import { fmtDate, fmtDateTime } from '../format';
import type { PunchRequest } from '../types';
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, Spinner, useLoad, useToast } from '../ui';
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

  async function cancel(id: number) {
    try { await post(`/me/requests/${id}/cancel`); toast('Solicitação cancelada.'); reload(); } catch (e: any) { toast(e.message, 'bad'); }
  }

  return (
    <>
      <PageHeader title="Minhas solicitações" subtitle="Ajustes de ponto enviados para aprovação do RH."
        actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus className="size-4" />Nova solicitação</Button>} />
      <ErrorBox error={error} />
      <Card pad={false}>
        {loading && !data ? <Spinner /> : !data?.requests.length ? (
          <Empty icon={<ClipboardList className="size-8" />} title="Nenhuma solicitação">Use “Nova solicitação” para incluir um horário esquecido ou corrigir uma marcação.</Empty>
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
      <RequestModal open={open} onClose={() => setOpen(false)} today={today.data?.today || new Date().toISOString().slice(0, 10)} onDone={reload} />
    </>
  );
}

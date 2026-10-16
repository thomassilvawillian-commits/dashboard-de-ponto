import { Check, CheckSquare, X } from 'lucide-react';
import { useState } from 'react';
import { get, post } from '../../api';
import { fmtDate, fmtDateTime } from '../../format';
import type { PunchRequest } from '../../types';
import { Badge, Button, Card, Empty, ErrorBox, Input, PageHeader, Select, Spinner, useLoad, useToast } from '../../ui';
import { REQUEST_STATUS } from '../MyRequests';

export default function Approvals() {
  const toast = useToast();
  const [status, setStatus] = useState('PENDENTE');
  const { data, error, loading, reload } = useLoad<{ requests: PunchRequest[] }>(() => get(`/admin/requests?status=${status}`), [status]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  async function decide(r: PunchRequest, action: 'approve' | 'reject') {
    setBusy(r.id);
    try {
      await post(`/admin/requests/${r.id}/${action}`, { note: notes[r.id] || null });
      toast(action === 'approve' ? 'Ajuste aprovado e aplicado ao espelho.' : 'Solicitação recusada.');
      reload();
    } catch (e: any) { toast(e.message, 'bad'); } finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader title="Aprovações" subtitle="Ajustes de ponto solicitados pelos colaboradores."
        actions={<Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação">
          <option value="PENDENTE">Pendentes</option><option value="APROVADO">Aprovadas</option><option value="REJEITADO">Recusadas</option><option value="TODAS">Todas</option>
        </Select>} />
      <ErrorBox error={error} />
      <Card pad={false}>
        {loading && !data ? <Spinner /> : !data?.requests.length ? (
          <Empty icon={<CheckSquare className="size-8" />} title={status === 'PENDENTE' ? 'Tudo em dia' : 'Nenhuma solicitação'}>{status === 'PENDENTE' && 'Não há ajustes aguardando aprovação.'}</Empty>
        ) : (
          <ul>
            {data.requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><b>{r.userName}</b> pede para {r.kind === 'ADD' ? 'incluir' : 'desconsiderar'} a marcação de <b className="tabular">{r.time}</b> em <b>{fmtDate(r.date)}</b></p>
                  <p className="mt-0.5 text-sm text-ink-2">“{r.reason}”</p>
                  <p className="mt-1 text-xs text-ink-3">Enviada em {fmtDateTime(r.createdAt)}{r.decidedBy ? ` · ${REQUEST_STATUS[r.status].label.toLowerCase()} por ${r.decidedBy}` : ''}{r.decisionNote ? ` · “${r.decisionNote}”` : ''}</p>
                </div>
                {r.status === 'PENDENTE' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input className="h-9 w-56" placeholder="Observação (opcional)" value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} aria-label="Observação" />
                    <Button size="sm" onClick={() => decide(r, 'reject')} disabled={busy === r.id}><X className="size-4" />Recusar</Button>
                    <Button size="sm" variant="primary" onClick={() => decide(r, 'approve')} loading={busy === r.id}><Check className="size-4" />Aprovar</Button>
                  </div>
                ) : <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

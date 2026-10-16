import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { del, get, post } from '../../api';
import { useAuth } from '../../auth';
import { fmtDate, fmtMin, parseHours } from '../../format';
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, cx, useLoad, useToast } from '../../ui';
import { UserSelect, useUsers } from '../../ui/UserSelect';

interface Adjustment { id: number; userId: number; userName: string; date: string; minutes: number; kind: string; note: string | null; createdBy: string | null }

export default function Bank() {
  const toast = useToast();
  const { user } = useAuth();
  const admin = user?.role === 'ADMIN';
  const users = useUsers();
  const [filter, setFilter] = useState('');
  const { data, error, loading, reload } = useLoad<{ adjustments: Adjustment[]; kinds: Record<string, string> }>(() => get(`/admin/adjustments${filter ? `?userId=${filter}` : ''}`), [filter]);
  const [form, setForm] = useState<{ userId: string; date: string; hours: string; direction: '+' | '-'; kind: string; note: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    const min = parseHours(form!.hours);
    if (!min || Number.isNaN(min)) return setFormError('Informe as horas, por exemplo 4 ou 2:30.');
    try {
      await post('/admin/adjustments', { userId: Number(form!.userId), date: form!.date, minutes: form!.direction === '-' ? -Math.abs(min) : Math.abs(min), kind: form!.kind, note: form!.note || null });
      toast('Movimentação registrada.'); setForm(null); reload();
    } catch (e: any) { setFormError(e.message); }
  }
  async function remove(id: number) {
    if (!confirm('Excluir esta movimentação do banco de horas?')) return;
    try { await del(`/admin/adjustments/${id}`); toast('Movimentação excluída.'); reload(); } catch (e: any) { toast(e.message, 'bad'); }
  }

  return (
    <>
      <PageHeader title="Banco de horas" subtitle="Pagamentos, descontos e correções que alteram o saldo acumulado."
        actions={<>
          <UserSelect users={users.data?.users || []} value={filter} onChange={setFilter} allowAll="Todos os colaboradores" />
          {admin && <Button variant="primary" onClick={() => { setFormError(null); setForm({ userId: filter, date: new Date().toISOString().slice(0, 10), hours: '', direction: '-', kind: 'PAGAMENTO', note: '' }); }}>Lançar</Button>}
        </>} />
      <ErrorBox error={error} />
      <Card pad={false}>
        {loading && !data ? <Spinner /> : !data?.adjustments.length ? (
          <Empty title="Nenhuma movimentação">Ao pagar horas extras ou corrigir um saldo, lance aqui para manter o banco de horas exato.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs font-medium text-ink-3">
                <th className="px-5 py-2.5">Data</th><th className="px-2 py-2.5">Colaborador</th><th className="px-2 py-2.5">Tipo</th><th className="px-2 py-2.5 text-right">Horas</th><th className="px-2 py-2.5">Observação</th><th className="px-5 py-2.5" />
              </tr></thead>
              <tbody className="tabular">
                {data.adjustments.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">{fmtDate(a.date)}</td>
                    <td className="px-2 py-3 font-medium">{a.userName}</td>
                    <td className="px-2 py-3 text-ink-2">{data.kinds[a.kind] || a.kind}</td>
                    <td className={cx('px-2 py-3 text-right font-semibold', a.minutes > 0 ? 'text-good-ink' : 'text-bad-ink')}>{fmtMin(a.minutes, { sign: true })}</td>
                    <td className="px-2 py-3 text-ink-2">{a.note || '—'}{a.createdBy && <span className="block text-xs text-ink-3">por {a.createdBy}</span>}</td>
                    <td className="px-5 py-3 text-right">{admin && <button onClick={() => remove(a.id)} className="rounded-md p-1.5 text-ink-3 hover:bg-bad-soft hover:text-bad-ink" aria-label="Excluir"><Trash2 className="size-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={!!form} onClose={() => setForm(null)} title="Lançar movimentação"
        footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button variant="primary" onClick={save}>Lançar</Button></>}>
        {form && <div className="flex flex-col gap-4">
          <Field label="Colaborador">{(id) => <UserSelect id={id} users={users.data?.users || []} value={form.userId} onChange={(v) => setForm({ ...form, userId: v })} />}</Field>
          <Field label="Tipo">{(id) => <Select id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, direction: ['PAGAMENTO', 'DESCONTO'].includes(e.target.value) ? '-' : '+' })}>
            {Object.entries(data?.kinds || {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
          <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-3">
            <Field label="Efeito">{(id) => <Select id={id} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as '+' | '-' })}><option value="-">Debitar</option><option value="+">Creditar</option></Select>}</Field>
            <Field label="Horas">{(id) => <Input id={id} placeholder="4:30" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />}</Field>
            <Field label="Data">{(id) => <Input id={id} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
          </div>
          <Field label="Observação">{(id) => <Input id={id} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex.: pagas na folha de outubro" />}</Field>
          <ErrorBox error={formError} />
        </div>}
      </Modal>
    </>
  );
}

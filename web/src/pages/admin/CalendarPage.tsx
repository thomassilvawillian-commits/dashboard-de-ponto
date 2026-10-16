import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { del, get, post } from '../../api';
import { useAuth } from '../../auth';
import { fmtDate } from '../../format';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useLoad, useToast } from '../../ui';
import { UserSelect, useUsers } from '../../ui/UserSelect';

interface Holiday { id: number; date: string; name: string }
interface Absence { id: number; userId: number; userName: string; startDate: string; endDate: string; type: string; note: string | null; selfJustified: boolean }

export default function CalendarPage() {
  const toast = useToast();
  const { user } = useAuth();
  const admin = user?.role === 'ADMIN';
  const [year, setYear] = useState(new Date().getFullYear());
  const hol = useLoad<{ holidays: Holiday[] }>(() => get(`/admin/holidays?year=${year}`), [year]);
  const abs = useLoad<{ absences: Absence[]; types: Record<string, { label: string; abona: boolean }> }>(() => get(`/admin/absences?from=${year}-01-01&to=${year}-12-31`), [year]);
  const users = useUsers();
  const [hForm, setHForm] = useState<{ date: string; name: string } | null>(null);
  const [aForm, setAForm] = useState<{ userId: string; startDate: string; endDate: string; type: string; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>, msg: string, after: () => void) {
    setError(null);
    try { await fn(); toast(msg); after(); } catch (e: any) { setError(e.message); toast(e.message, 'bad'); }
  }

  return (
    <>
      <PageHeader title="Feriados e ausências" subtitle="Dias que não geram falta: feriados, férias, atestados, licenças e folgas."
        actions={<Select className="w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Ano">
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`Feriados de ${year}`}
          actions={admin && <>
            <Button size="sm" onClick={() => act(() => post('/admin/holidays/national', { year }), 'Feriados nacionais adicionados.', hol.reload)}>Importar nacionais</Button>
            <Button size="sm" variant="primary" onClick={() => { setError(null); setHForm({ date: `${year}-01-01`, name: '' }); }}>Adicionar</Button>
          </>} pad={false}>
          {hol.loading && !hol.data ? <Spinner /> : !hol.data?.holidays.length ? (
            <Empty title="Nenhum feriado cadastrado">Importe os feriados nacionais e inclua os estaduais e municipais da sua cidade.</Empty>
          ) : (
            <ul>{hol.data.holidays.map((h) => (
              <li key={h.id} className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0">
                <span className="w-24 tabular text-sm font-medium">{fmtDate(h.date)}</span>
                <span className="flex-1 text-sm">{h.name}</span>
                {admin && <button className="rounded-md p-1.5 text-ink-3 hover:bg-bad-soft hover:text-bad-ink" aria-label={`Remover ${h.name}`} onClick={() => act(() => del(`/admin/holidays/${h.id}`), 'Feriado removido.', hol.reload)}><Trash2 className="size-4" /></button>}
              </li>
            ))}</ul>
          )}
        </Card>

        <Card title="Ausências e justificativas"
          actions={<Button size="sm" variant="primary" onClick={() => { setError(null); setAForm({ userId: '', startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), type: 'FERIAS', note: '' }); }}>Registrar</Button>} pad={false}>
          {abs.loading && !abs.data ? <Spinner /> : !abs.data?.absences.length ? (
            <Empty title="Nenhuma ausência registrada">Férias, atestados e folgas registrados aqui não geram falta no espelho.</Empty>
          ) : (
            <ul>{abs.data.absences.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.userName}</p>
                  <p className="text-xs text-ink-2 tabular">{fmtDate(a.startDate)}{a.endDate !== a.startDate ? ` a ${fmtDate(a.endDate)}` : ''}{a.note ? ` · ${a.note}` : ''}</p>
                  {a.selfJustified && <p className="text-xs text-ink-3">Justificada pelo colaborador</p>}
                </div>
                <Badge tone={abs.data!.types[a.type]?.abona === false ? 'warn' : 'brand'}>{abs.data!.types[a.type]?.label || a.type}</Badge>
                <button className="rounded-md p-1.5 text-ink-3 hover:bg-bad-soft hover:text-bad-ink" aria-label="Remover ausência" onClick={() => act(() => del(`/admin/absences/${a.id}`), 'Ausência removida.', abs.reload)}><Trash2 className="size-4" /></button>
              </li>
            ))}</ul>
          )}
        </Card>
      </div>

      <Modal open={!!hForm} onClose={() => setHForm(null)} title="Adicionar feriado"
        footer={<><Button variant="ghost" onClick={() => setHForm(null)}>Cancelar</Button><Button variant="primary" onClick={() => act(() => post('/admin/holidays', hForm), 'Feriado salvo.', () => { setHForm(null); hol.reload(); })}>Salvar</Button></>}>
        {hForm && <div className="flex flex-col gap-4">
          <Field label="Data">{(id) => <Input id={id} type="date" value={hForm.date} onChange={(e) => setHForm({ ...hForm, date: e.target.value })} />}</Field>
          <Field label="Nome">{(id) => <Input id={id} value={hForm.name} placeholder="Ex.: Aniversário da cidade" onChange={(e) => setHForm({ ...hForm, name: e.target.value })} />}</Field>
          <ErrorBox error={error} />
        </div>}
      </Modal>

      <Modal open={!!aForm} onClose={() => setAForm(null)} title="Registrar ausência"
        footer={<><Button variant="ghost" onClick={() => setAForm(null)}>Cancelar</Button><Button variant="primary" onClick={() => act(() => post('/admin/absences', { ...aForm, userId: Number(aForm!.userId), note: aForm!.note || null }), 'Ausência registrada.', () => { setAForm(null); abs.reload(); })}>Salvar</Button></>}>
        {aForm && <div className="flex flex-col gap-4">
          <Field label="Colaborador">{(id) => <UserSelect id={id} users={users.data?.users || []} value={aForm.userId} onChange={(v) => setAForm({ ...aForm, userId: v })} />}</Field>
          <Field label="Tipo" hint={abs.data?.types[aForm.type]?.abona === false ? 'A compensação desconta a jornada do dia do banco de horas.' : 'O dia não gera falta nem débito no banco.'}>
            {(id) => <Select id={id} value={aForm.type} onChange={(e) => setAForm({ ...aForm, type: e.target.value })}>{Object.entries(abs.data?.types || {}).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</Select>}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="De">{(id) => <Input id={id} type="date" value={aForm.startDate} onChange={(e) => setAForm({ ...aForm, startDate: e.target.value, endDate: e.target.value > aForm.endDate ? e.target.value : aForm.endDate })} />}</Field>
            <Field label="Até">{(id) => <Input id={id} type="date" min={aForm.startDate} value={aForm.endDate} onChange={(e) => setAForm({ ...aForm, endDate: e.target.value })} />}</Field>
          </div>
          <Field label="Observação">{(id) => <Textarea id={id} value={aForm.note} onChange={(e) => setAForm({ ...aForm, note: e.target.value })} />}</Field>
          <ErrorBox error={error} />
        </div>}
      </Modal>
    </>
  );
}

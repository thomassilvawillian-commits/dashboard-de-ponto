import { Copy, Plus, Search, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { get, patch, post } from '../../api';
import { useAuth } from '../../auth';
import { ROLE_LABEL, WEEKDAYS, fmtDate, fmtMin, hoursInput, parseHours } from '../../format';
import type { Schedule, User } from '../../types';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, useLoad, useToast } from '../../ui';
import { DEFAULT_SCHEDULE, ScheduleEditor, type ScheduleForm } from '../../ui/ScheduleEditor';

type Row = User & { schedule: Schedule | null };

export function TempPasswordModal({ value, name, onClose }: { value: string | null; name?: string; onClose: () => void }) {
  const toast = useToast();
  return (
    <Modal open={!!value} onClose={onClose} title="Senha temporária" footer={<Button variant="primary" onClick={onClose}>Concluir</Button>}>
      <p className="text-sm text-ink-2">Entregue esta senha a {name || 'o colaborador'}. Ela vale para o primeiro acesso, quando será pedida uma senha pessoal.</p>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 p-4">
        <code className="flex-1 text-center text-2xl font-semibold tracking-widest">{value}</code>
        <Button size="sm" onClick={() => { navigator.clipboard?.writeText(value || ''); toast('Senha copiada.'); }}><Copy className="size-4" />Copiar</Button>
      </div>
      <p className="mt-3 text-xs text-ink-3">Por segurança, a senha não poderá ser vista novamente. Se perder, gere outra.</p>
    </Modal>
  );
}

export function EmployeeForm({ open, onClose, user, onSaved }: { open: boolean; onClose: () => void; user?: User | null; onSaved: (u: User, temp?: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const blank = { name: '', username: '', email: '', role: 'FUNCIONARIO', registration: '', department: '', jobTitle: '', startDate: today, endDate: '', initialBalance: '0', trackTime: true, active: true };
  const [f, setF] = useState(blank);
  const [schedule, setSchedule] = useState<ScheduleForm>(DEFAULT_SCHEDULE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setError(null);
      setSchedule(DEFAULT_SCHEDULE);
      setF(user ? {
        name: user.name, username: user.username, email: user.email || '', role: user.role, registration: user.registration || '', department: user.department || '',
        jobTitle: user.jobTitle || '', startDate: user.startDate, endDate: user.endDate || '', initialBalance: hoursInput(user.initialBalanceMin), trackTime: user.trackTime, active: user.active,
      } : blank);
    }
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function save() {
    const initialBalanceMin = parseHours(f.initialBalance || '0');
    if (Number.isNaN(initialBalanceMin)) return setError('Saldo inicial inválido. Use, por exemplo, 2,5 ou -1:30.');
    setBusy(true);
    setError(null);
    const body: any = {
      name: f.name, username: f.username, email: f.email || null, role: f.role, registration: f.registration || null, department: f.department || null,
      jobTitle: f.jobTitle || null, startDate: f.startDate, endDate: f.endDate || null, initialBalanceMin, trackTime: f.trackTime, active: f.active,
    };
    try {
      if (user) {
        const r = await patch(`/admin/users/${user.id}`, body);
        onSaved(r.user);
      } else {
        const r = await post('/admin/users', { ...body, schedule });
        onSaved(r.user, r.temporaryPassword);
      }
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal wide open={open} onClose={onClose} title={user ? 'Editar colaborador' : 'Novo colaborador'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>{user ? 'Salvar alterações' : 'Cadastrar'}</Button></>}>
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo">{(id) => <Input id={id} value={f.name} onChange={set('name')} autoFocus />}</Field>
          <Field label="Usuário de acesso" hint="Usado no login">{(id) => <Input id={id} value={f.username} onChange={set('username')} autoComplete="off" />}</Field>
          <Field label="Cargo">{(id) => <Input id={id} value={f.jobTitle} onChange={set('jobTitle')} />}</Field>
          <Field label="Departamento">{(id) => <Input id={id} value={f.department} onChange={set('department')} />}</Field>
          <Field label="Matrícula">{(id) => <Input id={id} value={f.registration} onChange={set('registration')} />}</Field>
          <Field label="E-mail (opcional)">{(id) => <Input id={id} type="email" value={f.email} onChange={set('email')} />}</Field>
          <Field label="Perfil de acesso" hint="Gestor aprova ajustes e vê relatórios; administrador também gerencia cadastros e configurações.">
            {(id) => <Select id={id} value={f.role} onChange={set('role')}>{Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}
          </Field>
          <Field label="Saldo inicial do banco (horas)" hint="Ex.: 2,5 ou -1:30. Saldo anterior ao uso do sistema.">{(id) => <Input id={id} value={f.initialBalance} onChange={set('initialBalance')} />}</Field>
          <Field label="Início da apuração">{(id) => <Input id={id} type="date" value={f.startDate} onChange={set('startDate')} />}</Field>
          <Field label="Desligamento (opcional)">{(id) => <Input id={id} type="date" value={f.endDate} onChange={set('endDate')} />}</Field>
        </div>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.trackTime} onChange={(e) => setF({ ...f, trackTime: e.target.checked })} />Controlar jornada e banco de horas</label>
          {user && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Acesso ativo</label>}
        </div>
        {!user && (
          <div className="flex flex-col gap-3 border-t border-line pt-5">
            <h3 className="text-sm font-semibold">Jornada de trabalho</h3>
            <ScheduleEditor value={schedule} onChange={setSchedule} />
          </div>
        )}
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

export function scheduleSummary(s: Schedule | null) {
  if (!s) return '—';
  const days = Object.entries(s.dayMinutes).filter(([, m]) => m > 0);
  if (!days.length) return 'Sem jornada fixa';
  const total = days.reduce((a, [, m]) => a + m, 0);
  return `${days.map(([d]) => WEEKDAYS[Number(d)]).join(', ')} · ${fmtMin(total)}/semana`;
}

export default function Employees() {
  const { user: me } = useAuth();
  const nav = useNavigate();
  const { data, error, loading, reload } = useLoad<{ users: Row[] }>(() => get('/admin/users'), []);
  const [q, setQ] = useState('');
  const [show, setShow] = useState('ativos');
  const [formOpen, setFormOpen] = useState(false);
  const [temp, setTemp] = useState<{ value: string; name: string } | null>(null);
  const admin = me?.role === 'ADMIN';

  const rows = useMemo(() => (data?.users || []).filter((u) => {
    const t = q.trim().toLowerCase();
    if (t && !`${u.name} ${u.username} ${u.department || ''} ${u.registration || ''}`.toLowerCase().includes(t)) return false;
    return show === 'todos' || (show === 'ativos' ? u.active : !u.active);
  }), [data, q, show]);

  return (
    <>
      <PageHeader title="Colaboradores" subtitle="Cadastros, perfis de acesso e jornadas."
        actions={admin && <Button variant="primary" onClick={() => setFormOpen(true)}><UserPlus className="size-4" />Novo colaborador</Button>} />
      <ErrorBox error={error} />
      <Card pad={false} title={`${rows.length} colaborador(es)`} actions={<>
        <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" /><Input className="h-9 w-56 pl-8" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></div>
        <Select className="h-9 w-auto" value={show} onChange={(e) => setShow(e.target.value)} aria-label="Situação"><option value="ativos">Ativos</option><option value="inativos">Inativos</option><option value="todos">Todos</option></Select>
      </>}>
        {loading && !data ? <Spinner /> : !rows.length ? (
          <Empty icon={<Users className="size-8" />} title="Nenhum colaborador encontrado">
            {admin && <Button className="mt-3" variant="primary" onClick={() => setFormOpen(true)}><Plus className="size-4" />Cadastrar o primeiro</Button>}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs font-medium text-ink-3">
                <th className="px-5 py-2.5">Nome</th><th className="px-2 py-2.5">Usuário</th><th className="px-2 py-2.5">Perfil</th><th className="px-2 py-2.5">Jornada</th><th className="px-5 py-2.5">Desde</th>
              </tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2" onClick={() => nav(`/gestao/colaboradores/${u.id}`)}>
                    <td className="px-5 py-3"><p className="font-medium">{u.name}</p><p className="text-xs text-ink-3">{[u.jobTitle, u.department].filter(Boolean).join(' · ') || '—'}</p></td>
                    <td className="px-2 py-3 text-ink-2">{u.username}</td>
                    <td className="px-2 py-3"><div className="flex gap-1"><Badge tone={u.role === 'FUNCIONARIO' ? 'muted' : 'brand'}>{ROLE_LABEL[u.role]}</Badge>{!u.active && <Badge tone="bad">Inativo</Badge>}</div></td>
                    <td className="px-2 py-3 text-ink-2">{u.trackTime ? scheduleSummary(u.schedule) : 'Sem controle de jornada'}</td>
                    <td className="px-5 py-3 tabular text-ink-2">{fmtDate(u.startDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <EmployeeForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={(u, t) => { reload(); if (t) setTemp({ value: t, name: u.name }); }} />
      <TempPasswordModal value={temp?.value || null} name={temp?.name} onClose={() => setTemp(null)} />
    </>
  );
}

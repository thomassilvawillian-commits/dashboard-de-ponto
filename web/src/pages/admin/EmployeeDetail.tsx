import { ArrowLeft, CalendarPlus, KeyRound, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { del, get, post } from '../../api';
import { useAuth } from '../../auth';
import { BalanceChart } from '../../charts/BalanceChart';
import { ALERTS, ROLE_LABEL, SOURCE_LABEL, WEEKDAYS_LONG, fmtDate, fmtMin, fmtMonth, punchLabel } from '../../format';
import type { Day, MonthSummary, Schedule, User } from '../../types';
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Spinner, cx, useLoad, useToast } from '../../ui';
import { DEFAULT_SCHEDULE, ScheduleEditor, type ScheduleForm } from '../../ui/ScheduleEditor';
import { DayTable, MonthPicker, StatusBadge, SummaryStats } from '../../ui/timesheet';
import { EmployeeForm, TempPasswordModal, scheduleSummary } from './Employees';

function DayModal({ day, userId, onClose, onChanged }: { day: Day | null; userId: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastDay, setLastDay] = useState<Day | null>(null);
  if (day !== lastDay) { setLastDay(day); setTime(''); setNote(''); setRemoving(null); setReason(''); setError(null); }

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true); setError(null);
    try { await fn(); toast(msg); onChanged(); onClose(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal open={!!day} onClose={onClose} title={day ? `${WEEKDAYS_LONG[day.weekday]}, ${fmtDate(day.date)}` : ''}>
      {day && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge d={day} />
            <span className="text-sm text-ink-2">Trabalhado <b className="tabular text-ink">{fmtMin(day.workedMin)}</b> de {fmtMin(day.expectedMin)} · saldo <b className="tabular text-ink">{fmtMin(day.balanceMin, { sign: true })}</b></span>
          </div>
          {day.alerts.length > 0 && <div className="flex flex-col gap-1">{day.alerts.map((a) => <Badge key={a} tone="warn">{ALERTS[a]}</Badge>)}</div>}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Marcações</h3>
            {!day.punches.length && <p className="text-sm text-ink-3">Nenhuma marcação neste dia.</p>}
            <ul className="flex flex-col gap-1">
              {day.punches.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                  <span className="tabular font-semibold">{p.time}</span>
                  <span className="flex-1 text-sm text-ink-2">{punchLabel(i)}{p.note ? <span className="block text-xs text-ink-3">{p.note}</span> : null}</span>
                  <Badge tone={p.source === 'web' ? 'muted' : 'warn'}>{SOURCE_LABEL[p.source] || p.source}</Badge>
                  <button className="rounded-md p-1.5 text-ink-3 hover:bg-bad-soft hover:text-bad-ink" onClick={() => setRemoving(p.id)} aria-label={`Desconsiderar marcação das ${p.time}`}><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          </div>
          {removing ? (
            <div className="flex flex-col gap-3 rounded-xl bg-bad-soft/60 p-4">
              <p className="text-sm font-medium">Desconsiderar a marcação selecionada?</p>
              <Field label="Motivo (fica registrado na auditoria)">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setRemoving(null)}>Voltar</Button>
                <Button variant="danger" loading={busy} onClick={() => run(() => del(`/admin/punches/${removing}`, { reason }), 'Marcação desconsiderada.')}>Desconsiderar</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 border-t border-line pt-4">
              <h3 className="text-sm font-semibold">Incluir marcação</h3>
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <Field label="Horário">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
                <Field label="Motivo">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: esqueceu de registrar" />}</Field>
              </div>
              <Button variant="primary" loading={busy} disabled={!time} onClick={() => run(() => post(`/admin/users/${userId}/punches`, { date: day.date, time, note }), 'Marcação incluída.')}><Plus className="size-4" />Incluir</Button>
            </div>
          )}
          <ErrorBox error={error} />
        </div>
      )}
    </Modal>
  );
}

function SchedulesCard({ userId, admin }: { userId: number; admin: boolean }) {
  const toast = useToast();
  const { data, reload } = useLoad<{ user: User; schedules: Schedule[] }>(() => get(`/admin/users/${userId}`), [userId]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ScheduleForm>(DEFAULT_SCHEDULE);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    const cur = data?.schedules[0];
    setForm(cur ? { dayMinutes: cur.dayMinutes, expectedStart: cur.expectedStart || '', breakMinutes: cur.breakMinutes } : DEFAULT_SCHEDULE);
    setError(null);
    setOpen(true);
  }
  async function save() {
    try {
      await post(`/admin/users/${userId}/schedules`, { ...form, expectedStart: form.expectedStart || null, validFrom });
      toast('Jornada salva.'); setOpen(false); reload();
    } catch (e: any) { setError(e.message); }
  }
  async function remove(id: number) {
    try { await del(`/admin/schedules/${id}`); toast('Jornada removida.'); reload(); } catch (e: any) { toast(e.message, 'bad'); }
  }

  return (
    <Card title="Jornadas" actions={admin && <Button size="sm" onClick={startNew}><CalendarPlus className="size-4" />Nova vigência</Button>}>
      <p className="mb-3 text-xs text-ink-3">Cada jornada vale a partir da data indicada. Mudanças não alteram o cálculo de dias anteriores.</p>
      <ul className="flex flex-col gap-2">
        {data?.schedules.map((s, i) => (
          <li key={s.id} className={cx('flex items-center gap-3 rounded-lg border px-3 py-2.5', i === 0 ? 'border-brand/40 bg-brand-soft/40' : 'border-line')}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">A partir de {fmtDate(s.validFrom)} {i === 0 && <Badge tone="brand">Mais recente</Badge>}</p>
              <p className="text-xs text-ink-2">{scheduleSummary(s)}{s.expectedStart ? ` · entrada ${s.expectedStart}` : ''} · intervalo {s.breakMinutes} min</p>
            </div>
            {admin && data.schedules.length > 1 && <button onClick={() => remove(s.id!)} className="rounded-md p-1.5 text-ink-3 hover:bg-bad-soft hover:text-bad-ink" aria-label="Remover jornada"><Trash2 className="size-4" /></button>}
          </li>
        ))}
      </ul>
      <Modal wide open={open} onClose={() => setOpen(false)} title="Nova vigência de jornada"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button variant="primary" onClick={save}>Salvar</Button></>}>
        <div className="flex flex-col gap-4">
          <Field label="Válida a partir de">{(id) => <Input id={id} type="date" className="max-w-48" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />}</Field>
          <ScheduleEditor value={form} onChange={setForm} />
          <ErrorBox error={error} />
        </div>
      </Modal>
    </Card>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const userId = Number(id);
  const { user: me } = useAuth();
  const admin = me?.role === 'ADMIN';
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const month = params.get('m') || new Date().toISOString().slice(0, 7);
  const { data, error, loading, reload } = useLoad<{ user: User; summary: MonthSummary; today: string }>(() => get(`/admin/users/${userId}/month?m=${month}`), [userId, month]);
  const [day, setDay] = useState<Day | null>(null);
  const [edit, setEdit] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);

  async function resetPassword() {
    if (!confirm('Gerar uma nova senha temporária? A senha atual deixará de funcionar.')) return;
    try { const r = await post(`/admin/users/${userId}/reset-password`); setTemp(r.temporaryPassword); } catch (e: any) { toast(e.message, 'bad'); }
  }

  const u = data?.user;
  return (
    <>
      <Link to="/gestao/colaboradores" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="size-4" />Colaboradores</Link>
      <PageHeader title={u?.name || 'Colaborador'}
        subtitle={u && <span>{[u.jobTitle, u.department, u.registration && `Matrícula ${u.registration}`, ROLE_LABEL[u.role]].filter(Boolean).join(' · ')} · espelho de {fmtMonth(month)}</span>}
        actions={<>
          <MonthPicker value={month} onChange={(m) => setParams({ m })} max={data?.today.slice(0, 7)} />
          <Button onClick={() => print()}><Printer className="size-4" />Imprimir</Button>
          {admin && <Button onClick={() => setEdit(true)}><Pencil className="size-4" />Editar</Button>}
          {admin && <Button onClick={resetPassword}><KeyRound className="size-4" />Senha temporária</Button>}
        </>} />
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data && (
        <div className="flex flex-col gap-6">
          {!data.user.active && <ErrorBox error="Este colaborador está inativo e não consegue entrar no sistema." />}
          <SummaryStats s={data.summary} />
          <div className="grid gap-6 xl:grid-cols-3">
            <Card title="Saldo diário" className="no-print xl:col-span-2"><BalanceChart days={data.summary.days} /></Card>
            <div className="no-print"><SchedulesCard userId={userId} admin={admin} /></div>
          </div>
          <Card title="Espelho de ponto" pad={false} actions={<span className="no-print text-xs text-ink-3">Clique em um dia para incluir ou desconsiderar marcações</span>}>
            <DayTable days={data.summary.days} today={data.today} onDayClick={(d) => d.status !== 'futuro' && setDay(d)} />
          </Card>
          <div className="hidden print:block">
            <div className="mt-16 grid grid-cols-2 gap-16 text-center text-sm">
              <div className="border-t border-black pt-2">{data.user.name}</div>
              <div className="border-t border-black pt-2">Responsável pelo RH</div>
            </div>
          </div>
        </div>
      )}
      <DayModal day={day} userId={userId} onClose={() => setDay(null)} onChanged={reload} />
      <EmployeeForm open={edit} onClose={() => setEdit(false)} user={u} onSaved={() => { toast('Cadastro atualizado.'); reload(); }} />
      <TempPasswordModal value={temp} name={u?.name} onClose={() => setTemp(null)} />
    </>
  );
}

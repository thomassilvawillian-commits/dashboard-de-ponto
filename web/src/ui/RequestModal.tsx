import { useEffect, useState } from 'react';
import { post } from '../api';
import { fmtDate, punchLabel } from '../format';
import type { Day } from '../types';
import { Button, ErrorBox, Field, Input, Modal, Textarea, cx, useToast } from './index';

/** Pedido de ajuste: incluir um horário esquecido ou desconsiderar uma marcação errada. */
export function RequestModal({ open, onClose, day, today, onDone }: { open: boolean; onClose: () => void; day?: Day | null; today: string; onDone?: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'ADD' | 'REMOVE'>('ADD');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [punchId, setPunchId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('ADD'); setDate(day?.date || today); setTime(''); setPunchId(null); setReason(''); setError(null);
  }, [open, day, today]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await post('/me/requests', mode === 'ADD' ? { kind: 'ADD', date, time, reason } : { kind: 'REMOVE', punchId, reason });
      toast(r.request.status === 'APROVADO' ? 'Ajuste aplicado.' : 'Solicitação enviada para aprovação do RH.');
      onDone?.();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const punches = day?.punches || [];
  return (
    <Modal open={open} onClose={onClose} title="Solicitar ajuste de ponto"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={submit} disabled={mode === 'REMOVE' && !punchId}>Enviar solicitação</Button></>}>
      <div className="flex flex-col gap-4">
        {punches.length > 0 && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-sm font-medium">
            {(['ADD', 'REMOVE'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cx('rounded-md py-1.5', mode === m ? 'bg-surface shadow-sm' : 'text-ink-2')}>
                {m === 'ADD' ? 'Incluir horário' : 'Desconsiderar marcação'}
              </button>
            ))}
          </div>
        )}
        {mode === 'ADD' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">{(id) => <Input id={id} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Horário">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-[13px] font-medium text-ink-2">Marcação de {day && fmtDate(day.date)}</p>
            <div className="flex flex-wrap gap-2">
              {punches.map((p, i) => (
                <button key={p.id} onClick={() => setPunchId(p.id)}
                  className={cx('rounded-lg border px-3 py-2 text-left text-sm', punchId === p.id ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface-2')}>
                  <span className="block font-medium tabular">{p.time}</span><span className="text-xs text-ink-3">{punchLabel(i)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Motivo" hint="Ex.: esqueci de registrar a saída; registrei duas vezes por engano.">
          {(id) => <Textarea id={id} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

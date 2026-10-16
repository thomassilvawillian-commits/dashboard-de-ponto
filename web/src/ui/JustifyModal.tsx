import { useEffect, useState } from 'react';
import { post } from '../api';
import { fmtDate } from '../format';
import { Button, ErrorBox, Field, Input, Modal, Select, Textarea, useToast } from './index';

export const JUSTIFICATION_TYPES: Record<string, string> = {
  ATESTADO: 'Atestado médico ou consulta',
  ABONO: 'Motivo pessoal ou outro',
  FOLGA: 'Folga combinada',
  LICENCA: 'Licença (casamento, luto, nascimento...)',
};

/** O colaborador justifica uma falta; o dia é abonado na hora, sem aprovação do RH. */
export function JustifyModal({ date, today, onClose, onDone }: { date: string | null; today: string; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [type, setType] = useState('ATESTADO');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!date) return;
    setStart(date); setEnd(date); setType('ATESTADO'); setNote(''); setError(null);
  }, [date]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post('/me/absences', { startDate: start, endDate: end, type, note });
      toast(start === end ? `Falta de ${fmtDate(start)} justificada.` : 'Faltas justificadas.');
      onDone?.();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!date} onClose={onClose} title="Justificar falta"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={submit}>Justificar</Button></>}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">A justificativa vale na hora e o dia deixa de contar como falta. O RH pode consultá-la a qualquer momento.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="De">{(id) => <Input id={id} type="date" max={today} value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} />}</Field>
          <Field label="Até">{(id) => <Input id={id} type="date" min={start} max={today} value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
        </div>
        <Field label="Tipo">{(id) => <Select id={id} value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(JUSTIFICATION_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
        <Field label="Motivo">{(id) => <Textarea id={id} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: consulta no posto de saúde" />}</Field>
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

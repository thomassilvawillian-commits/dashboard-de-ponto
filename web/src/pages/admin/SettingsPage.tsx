import { useEffect, useState } from 'react';
import { get, put } from '../../api';
import { useAuth } from '../../auth';
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner, useLoad, useToast } from '../../ui';
import { TIMEZONES } from '../Setup';

interface Settings {
  companyName: string; timezone: string; toleranceDailyMin: number; toleranceLateMin: number; autoApproveRequests: boolean; sharedComputer: boolean;
}

function Toggle({ checked, onChange, title, text }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 hover:bg-surface-2">
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><span className="block text-sm font-medium">{title}</span><span className="text-xs text-ink-2">{text}</span></span>
    </label>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { refresh } = useAuth();
  const { data, error, loading } = useLoad<{ settings: Settings }>(() => get('/admin/settings'), []);
  const [s, setS] = useState<Settings | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setS(data.settings); }, [data]);

  async function save() {
    setBusy(true); setSaveError(null);
    try { await put('/admin/settings', s); toast('Configurações salvas.'); refresh(); } catch (e: any) { setSaveError(e.message); } finally { setBusy(false); }
  }

  if (loading || !s) return error ? <ErrorBox error={error} /> : <Spinner />;
  const num = (k: keyof Settings) => (e: { target: { value: string } }) => setS({ ...s, [k]: Number(e.target.value) });

  return (
    <>
      <PageHeader title="Configurações" subtitle="Regras gerais aplicadas a toda a empresa."
        actions={<Button variant="primary" loading={busy} onClick={save}>Salvar</Button>} />
      <div className="grid max-w-4xl gap-6">
        <Card title="Empresa">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da empresa">{(id) => <Input id={id} value={s.companyName} onChange={(e) => setS({ ...s, companyName: e.target.value })} />}</Field>
            <Field label="Fuso horário" hint="Define o dia e o horário de todas as marcações.">{(id) => (
              <Select id={id} value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })}>
                {!TIMEZONES.some(([v]) => v === s.timezone) && <option value={s.timezone}>{s.timezone}</option>}
                {TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            )}</Field>
          </div>
        </Card>
        <Card title="Regras de apuração">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tolerância diária (min)" hint="Variações até este limite no dia não geram saldo. CLT: até 10 min.">{(id) => <Input id={id} type="number" min={0} max={60} value={s.toleranceDailyMin} onChange={num('toleranceDailyMin')} />}</Field>
            <Field label="Tolerância de atraso (min)" hint="Atrasos na entrada até este limite não são contados.">{(id) => <Input id={id} type="number" min={0} max={120} value={s.toleranceLateMin} onChange={num('toleranceLateMin')} />}</Field>
          </div>
        </Card>
        <Card title="Computador compartilhado">
          <Toggle checked={s.sharedComputer} onChange={(v) => setS({ ...s, sharedComputer: v })} title="Sair da conta depois de registrar o ponto"
            text="Use quando todos batem o ponto no mesmo computador: 5 segundos após registrar, o sistema sai da conta para a próxima pessoa." />
        </Card>
        <Card title="Ajustes de ponto">
          <Toggle checked={s.autoApproveRequests} onChange={(v) => setS({ ...s, autoApproveRequests: v })} title="Aprovar ajustes automaticamente"
            text="Os ajustes pedidos pelos colaboradores entram no espelho na hora, sem esperar aprovação do RH." />
        </Card>
        <ErrorBox error={saveError} />
      </div>
    </>
  );
}

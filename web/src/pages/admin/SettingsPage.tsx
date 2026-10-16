import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { get, put } from '../../api';
import { useAuth } from '../../auth';
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner, useLoad, useToast } from '../../ui';
import { TIMEZONES } from '../Setup';

interface Settings {
  companyName: string; timezone: string; toleranceDailyMin: number; toleranceLateMin: number; minPunchIntervalMin: number;
  autoApproveRequests: boolean; requestGeolocation: boolean; allowedNetworks: string;
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
        actions={<Button variant="primary" loading={busy} onClick={save}><Save className="size-4" />Salvar</Button>} />
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tolerância diária (min)" hint="Variações até este limite no dia não geram saldo. CLT: até 10 min.">{(id) => <Input id={id} type="number" min={0} max={60} value={s.toleranceDailyMin} onChange={num('toleranceDailyMin')} />}</Field>
            <Field label="Tolerância de atraso (min)" hint="Atrasos na entrada até este limite não são contados.">{(id) => <Input id={id} type="number" min={0} max={120} value={s.toleranceLateMin} onChange={num('toleranceLateMin')} />}</Field>
            <Field label="Intervalo entre marcações (min)" hint="Evita registros duplicados por toque repetido.">{(id) => <Input id={id} type="number" min={0} max={60} value={s.minPunchIntervalMin} onChange={num('minPunchIntervalMin')} />}</Field>
          </div>
        </Card>
        <Card title="Registro e solicitações">
          <div className="grid gap-3">
            <Toggle checked={s.autoApproveRequests} onChange={(v) => setS({ ...s, autoApproveRequests: v })} title="Aprovar ajustes automaticamente"
              text="Solicitações de ajuste dos colaboradores entram no espelho sem passar pela aprovação do RH (comportamento da versão em planilha)." />
            <Toggle checked={s.requestGeolocation} onChange={(v) => setS({ ...s, requestGeolocation: v })} title="Registrar localização"
              text="Pede a localização do aparelho no momento da marcação. O colaborador pode negar; a marcação é registrada mesmo assim." />
            <Field label="Restringir a redes da empresa" hint="IPs ou prefixos separados por vírgula, ex.: 200.150.10.20, 192.168.0. — deixe vazio para permitir qualquer rede.">
              {(id) => <Input id={id} value={s.allowedNetworks} onChange={(e) => setS({ ...s, allowedNetworks: e.target.value })} />}
            </Field>
          </div>
        </Card>
        <ErrorBox error={saveError} />
      </div>
    </>
  );
}

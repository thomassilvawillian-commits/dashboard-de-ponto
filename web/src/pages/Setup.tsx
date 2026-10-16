import { Rocket } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { post } from '../api';
import { useAuth } from '../auth';
import { Button, ErrorBox, Field, Input, Select } from '../ui';
import AuthLayout from './AuthLayout';

export const TIMEZONES = [
  ['America/Sao_Paulo', 'Brasília (SP, RJ, MG, Sul, GO, DF, BA, NE)'],
  ['America/Manaus', 'Amazonas (Manaus)'],
  ['America/Cuiaba', 'Mato Grosso / Mato Grosso do Sul'],
  ['America/Porto_Velho', 'Rondônia'],
  ['America/Boa_Vista', 'Roraima'],
  ['America/Rio_Branco', 'Acre'],
  ['America/Belem', 'Pará / Amapá'],
  ['America/Noronha', 'Fernando de Noronha'],
  ['Europe/Lisbon', 'Portugal (Lisboa)'],
];

export default function Setup() {
  const { refresh } = useAuth();
  const [f, setF] = useState({ companyName: '', timezone: 'America/Sao_Paulo', name: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.password !== f.confirm) return setError('As senhas não conferem.');
    setBusy(true);
    setError(null);
    try {
      await post('/auth/setup', f);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout wide title="Bem-vindo ao Controle de Ponto" subtitle="Configure a empresa e crie a conta de administrador. Leva menos de um minuto.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da empresa">{(id) => <Input id={id} value={f.companyName} onChange={set('companyName')} required autoFocus />}</Field>
          <Field label="Fuso horário">{(id) => <Select id={id} value={f.timezone} onChange={set('timezone')}>{TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</Field>
        </div>
        <div className="border-t border-line" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Seu nome">{(id) => <Input id={id} value={f.name} onChange={set('name')} required />}</Field>
          <Field label="Usuário de acesso">{(id) => <Input id={id} value={f.username} onChange={set('username')} autoComplete="username" required />}</Field>
          <Field label="Senha" hint="Mínimo de 6 caracteres">{(id) => <Input id={id} type="password" value={f.password} onChange={set('password')} autoComplete="new-password" required />}</Field>
          <Field label="Confirme a senha">{(id) => <Input id={id} type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" required />}</Field>
        </div>
        <ErrorBox error={error} />
        <Button variant="primary" size="lg" loading={busy} type="submit"><Rocket className="size-4" />Começar</Button>
      </form>
    </AuthLayout>
  );
}

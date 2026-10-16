import { useState, type FormEvent } from 'react';
import { post } from '../api';
import { useAuth } from '../auth';
import { Button, Card, ErrorBox, Field, Input, PageHeader, useToast } from '../ui';
import AuthLayout from './AuthLayout';

export default function ChangePassword({ forced }: { forced?: boolean }) {
  const { refresh, logout } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.next !== f.confirm) return setError('A nova senha e a confirmação não conferem.');
    setBusy(true);
    setError(null);
    try {
      await post('/auth/password', { current: f.current, next: f.next });
      toast('Senha alterada com sucesso.');
      setF({ current: '', next: '', confirm: '' });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={forced ? 'Senha temporária ou PIN atual' : 'Senha atual'}>{(id) => <Input id={id} type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoComplete="current-password" required autoFocus />}</Field>
      <Field label="Nova senha" hint="Mínimo de 6 caracteres">{(id) => <Input id={id} type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} autoComplete="new-password" required />}</Field>
      <Field label="Confirme a nova senha">{(id) => <Input id={id} type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" required />}</Field>
      <ErrorBox error={error} />
      <Button variant="primary" loading={busy} type="submit">Salvar nova senha</Button>
      {forced && <Button variant="ghost" type="button" onClick={logout}>Sair</Button>}
    </form>
  );

  if (forced) return <AuthLayout title="Defina sua senha" subtitle="No primeiro acesso é preciso trocar a senha recebida por uma senha pessoal.">{form}</AuthLayout>;
  return (
    <>
      <PageHeader title="Trocar senha" subtitle="As outras sessões abertas com sua conta serão encerradas." />
      <Card className="max-w-md">{form}</Card>
    </>
  );
}

import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { post } from '../api';
import { useAuth } from '../auth';
import { Button, ErrorBox, Field, Input } from '../ui';
import AuthLayout from './AuthLayout';

export default function Login() {
  const { refresh, company } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/login', { username, password });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={company?.name || 'Controle de Ponto'} subtitle="Entre para registrar seu ponto">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Usuário">{(id) => <Input id={id} autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />}</Field>
        <Field label="Senha ou PIN">{(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}</Field>
        <ErrorBox error={error} />
        <Button variant="primary" size="lg" loading={busy} type="submit"><LogIn className="size-4" />Entrar</Button>
        <p className="text-center text-xs text-ink-3">Esqueceu a senha? Peça ao RH para gerar uma senha temporária.</p>
      </form>
    </AuthLayout>
  );
}

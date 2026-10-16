import { get } from '../api';
import type { User } from '../types';
import { Select, useLoad } from './index';

export function useUsers() {
  return useLoad<{ users: User[] }>(() => get('/admin/users'), []);
}

export function UserSelect({ id, value, onChange, allowAll, users }: { id?: string; value: string; onChange: (v: string) => void; allowAll?: string; users: User[] }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowAll ? <option value="">{allowAll}</option> : <option value="" disabled>Selecione…</option>}
      {users.filter((u) => u.active || u.id === Number(value)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </Select>
  );
}

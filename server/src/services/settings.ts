import type { Queryable } from '../db/index.js';

export interface Settings {
  companyName: string;
  timezone: string;
  toleranceDailyMin: number;
  toleranceLateMin: number;
  autoApproveRequests: boolean;
  /** Computador usado por várias pessoas: sai da conta logo após registrar o ponto. */
  sharedComputer: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  companyName: 'Minha Empresa',
  timezone: 'America/Sao_Paulo',
  toleranceDailyMin: 10,
  toleranceLateMin: 5,
  autoApproveRequests: false,
  sharedComputer: true,
};

export async function getSettings(q: Queryable): Promise<Settings> {
  const rows = await q.query<{ key: string; value: any }>('select key, value from settings');
  const out: any = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  return out;
}

export async function saveSettings(q: Queryable, patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    await q.query(
      `insert into settings (key, value) values ($1, $2::jsonb)
       on conflict (key) do update set value = excluded.value`, [key, JSON.stringify(value)]);
  }
}

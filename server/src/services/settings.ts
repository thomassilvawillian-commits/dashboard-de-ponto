import type { Queryable } from '../db/index.js';

export interface Settings {
  companyName: string;
  timezone: string;
  toleranceDailyMin: number;
  toleranceLateMin: number;
  minPunchIntervalMin: number;
  autoApproveRequests: boolean;
  requestGeolocation: boolean;
  allowedNetworks: string;
}

export const DEFAULT_SETTINGS: Settings = {
  companyName: 'Minha Empresa',
  timezone: 'America/Sao_Paulo',
  toleranceDailyMin: 10,
  toleranceLateMin: 5,
  minPunchIntervalMin: 1,
  autoApproveRequests: false,
  requestGeolocation: false,
  allowedNetworks: '',
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

/** Lista de IPs/prefixos separados por vírgula, ex.: "200.10.20.30, 192.168.0.". Vazio = qualquer rede. */
export function ipAllowed(ip: string, allowed: string) {
  const list = allowed.split(',').map((s) => s.trim()).filter(Boolean);
  return !list.length || list.some((p) => (p.endsWith('.') || p.endsWith(':') ? ip.startsWith(p) : ip === p));
}

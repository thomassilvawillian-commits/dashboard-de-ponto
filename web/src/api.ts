export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

type Listener = () => void;
const expiredListeners = new Set<Listener>();
export const onSessionExpired = (fn: Listener) => { expiredListeners.add(fn); return () => { expiredListeners.delete(fn); }; };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && data?.code === 'SESSAO_EXPIRADA') expiredListeners.forEach((f) => f());
    throw new ApiError(res.status, data?.error || 'Não foi possível concluir a operação.', data?.code);
  }
  return data as T;
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const patch = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const put = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });
export const del = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body });

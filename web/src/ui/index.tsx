import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'secondary', size = 'md', loading, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const v = {
    primary: 'bg-brand text-on-brand hover:bg-brand-strong border-transparent',
    secondary: 'bg-surface text-ink border-line hover:bg-surface-2',
    ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-surface-2 hover:text-ink',
    danger: 'bg-bad text-white border-transparent hover:opacity-90',
  }[variant];
  const s = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-base gap-2' }[size];
  return (
    <button {...rest} disabled={rest.disabled || loading}
      className={cx('inline-flex items-center justify-center rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap', v, s, className)}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">{label}</label>
      {children(id)}
      {error ? <p className="text-xs text-bad-ink">{error}</p> : hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

const inputCls = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60';
const withWidth = (className?: string) => (/(^|\s)w-/.test(className || '') ? inputCls.replace('w-full ', '') : inputCls);
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(withWidth(className), className)} />;
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(withWidth(className), 'pr-8', className)} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, 'h-auto min-h-20 py-2', className)} />;

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export type Tone = 'good' | 'warn' | 'bad' | 'brand' | 'muted';
export function Badge({ tone = 'muted', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  const t = {
    good: 'bg-good-soft text-good-ink', warn: 'bg-warn-soft text-warn-ink', bad: 'bg-bad-soft text-bad-ink',
    brand: 'bg-brand-soft text-brand-strong', muted: 'bg-surface-2 text-ink-2',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', t)}>{icon}{children}</span>;
}

export function Stat({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad'; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <div className="flex items-center gap-2 text-[13px] text-ink-2">{icon}{label}</div>
      <div className={cx('text-2xl font-semibold tracking-tight', tone === 'good' && 'text-good-ink', tone === 'bad' && 'text-bad-ink')}>{value}</div>
      {sub && <div className="text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 p-10 text-sm text-ink-3"><Loader2 className="size-4 animate-spin" />{label}</div>;
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-ink-3">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-3">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <div role="alert" className="flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2.5 text-sm text-bad-ink"><XCircle className="mt-0.5 size-4 shrink-0" />{error}</div>;
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}
      className={cx('m-auto w-[calc(100%-32px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40', wide ? 'max-w-2xl' : 'max-w-md')}>
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Fechar"><X className="size-5" /></button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/* Notificações rápidas */
type Toast = { id: number; tone: 'good' | 'bad' | 'info'; text: string };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'good') => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, tone, text }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="card pointer-events-auto flex max-w-md items-center gap-2 px-4 py-3 text-sm">
            {t.tone === 'good' ? <CheckCircle2 className="size-4 text-good" /> : t.tone === 'bad' ? <AlertTriangle className="size-4 text-bad" /> : <Info className="size-4 text-brand" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* Busca de dados com estado de carregamento e erro */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn().then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

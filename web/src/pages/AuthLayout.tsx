import { Timer } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AuthLayout({ title, subtitle, children, wide }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className={wide ? 'w-full max-w-lg' : 'w-full max-w-sm'}>
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand text-on-brand shadow-lg"><Timer className="size-6" /></div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-2">{subtitle}</p>}
        </div>
        <div className="card p-6">{children}</div>
      </div>
      <p className="absolute bottom-4 right-4 text-xs text-ink-3">Software criado por Willian Thomas</p>
    </div>
  );
}

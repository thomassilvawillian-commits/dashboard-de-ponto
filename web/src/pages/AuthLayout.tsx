import type { ReactNode } from 'react';

export default function AuthLayout({ title, subtitle, children, wide }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className={wide ? 'w-full max-w-lg' : 'w-full max-w-sm'}>
        <div className="card">
          <div className="border-b border-line px-5 py-4">
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
      <p className="absolute bottom-4 right-4 text-xs text-ink-3">Software criado por Willian Thomas</p>
    </div>
  );
}

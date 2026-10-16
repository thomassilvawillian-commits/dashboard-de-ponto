import { Menu, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { get } from './api';
import { isManager, useAuth } from './auth';
import { ROLE_LABEL } from './format';
import { cx } from './ui';

function useTheme() {
  const [theme, setTheme] = useState<string>(() => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('tema', next); } catch { /* armazenamento indisponível */ }
    setTheme(next);
  };
  return { theme, toggle };
}

function Item({ to, children, badge, end }: { to: string; children: ReactNode; badge?: number; end?: boolean }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => cx('flex items-center border-l-[3px] px-3 py-1.5 text-sm',
        isActive ? 'border-brand bg-brand-soft font-semibold text-brand-strong' : 'border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink')}>
      <span className="flex-1">{children}</span>
      {!!badge && <span className="rounded-sm bg-bad-ink px-1.5 text-[11px] font-semibold leading-5 text-surface">{badge}</span>}
    </NavLink>
  );
}

export default function Shell() {
  const { user, company, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const loc = useLocation();
  const manager = isManager(user);
  const admin = user?.role === 'ADMIN';

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!manager) return;
    const load = () => get('/admin/requests?status=PENDENTE').then((r) => setPending(r.requests.length)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [manager, loc.pathname]);

  const nav = (
    <nav className="flex flex-col gap-5">
      <div className="flex flex-col">
        <p className="px-3 pb-1 text-xs font-semibold text-ink-3">Meu ponto</p>
        <Item to="/" end>Registrar ponto</Item>
        <Item to="/espelho">Meu espelho</Item>
        <Item to="/solicitacoes">Minhas solicitações</Item>
        <Item to="/senha">Trocar senha</Item>
      </div>
      {manager && (
        <div className="flex flex-col">
          <p className="px-3 pb-1 text-xs font-semibold text-ink-3">Gestão</p>
          <Item to="/gestao" end>Painel</Item>
          <Item to="/gestao/colaboradores">Colaboradores</Item>
          <Item to="/gestao/aprovacoes" badge={pending}>Aprovações</Item>
          <Item to="/gestao/calendario">Feriados e ausências</Item>
          <Item to="/gestao/banco">Banco de horas</Item>
          <Item to="/gestao/relatorios">Relatórios</Item>
          {admin && <Item to="/gestao/configuracoes">Configurações</Item>}
        </div>
      )}
    </nav>
  );

  const userBox = (
    <div className="border-t border-line px-3 pt-3 text-sm">
      <p className="font-medium">{user?.name}</p>
      <p className="text-xs text-ink-3">{user && ROLE_LABEL[user.role]}</p>
      <div className="mt-2 flex gap-3 text-xs">
        <button onClick={toggle} className="text-ink-2 underline-offset-2 hover:underline">{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</button>
        <button onClick={logout} className="text-ink-2 underline-offset-2 hover:underline">Sair</button>
      </div>
    </div>
  );

  const title = <p className="truncate px-3 text-[15px] font-semibold">{company?.name || 'Controle de Ponto'}</p>;

  return (
    <div className="min-h-dvh lg:pl-56">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-56 flex-col gap-5 border-r border-line bg-surface py-4 lg:flex">
        {title}
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {userBox}
      </aside>

      <header className="no-print sticky top-0 z-20 flex h-12 items-center justify-between border-b border-line bg-surface px-2 lg:hidden">
        {title}
        <button onClick={() => setOpen(true)} className="rounded p-2 hover:bg-surface-2" aria-label="Abrir menu"><Menu className="size-5" /></button>
      </header>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-64 max-w-[85vw] flex-col gap-5 bg-surface py-4">
            <div className="flex items-center justify-between pr-2">{title}<button onClick={() => setOpen(false)} className="rounded p-2 hover:bg-surface-2" aria-label="Fechar menu"><X className="size-5" /></button></div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {userBox}
          </aside>
        </div>
      )}

      <main className="print-full mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <Outlet />
      </main>
      <footer className="no-print px-4 pb-5 text-center text-xs text-ink-3 lg:pr-6 lg:text-right">Software criado por Willian Thomas</footer>
    </div>
  );
}

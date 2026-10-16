import { BarChart3, CalendarDays, CheckSquare, Clock, FileSpreadsheet, History, KeyRound, LogOut, Menu, Moon, Scale, Settings, Sun, Timer, Users, X, ClipboardList } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
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

function Item({ to, icon, children, badge, end }: { to: string; icon: ReactNode; children: ReactNode; badge?: number; end?: boolean }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive ? 'bg-brand-soft text-brand-strong' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
      <span className="[&>svg]:size-[18px]">{icon}</span>
      <span className="flex-1">{children}</span>
      {!!badge && <span className="rounded-full bg-bad px-1.5 text-[11px] font-semibold leading-5 text-white">{badge}</span>}
    </NavLink>
  );
}

export default function Shell() {
  const { user, company, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const loc = useLocation();
  const nav = useNavigate();
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

  const nav_ = (
    <nav className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Meu ponto</p>
        <Item to="/" end icon={<Clock />}>Registrar ponto</Item>
        <Item to="/espelho" icon={<CalendarDays />}>Meu espelho</Item>
        <Item to="/solicitacoes" icon={<ClipboardList />}>Minhas solicitações</Item>
      </div>
      {manager && (
        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Gestão</p>
          <Item to="/gestao" end icon={<BarChart3 />}>Painel</Item>
          <Item to="/gestao/colaboradores" icon={<Users />}>Colaboradores</Item>
          <Item to="/gestao/aprovacoes" icon={<CheckSquare />} badge={pending}>Aprovações</Item>
          <Item to="/gestao/calendario" icon={<CalendarDays />}>Feriados e ausências</Item>
          <Item to="/gestao/banco" icon={<Scale />}>Banco de horas</Item>
          <Item to="/gestao/relatorios" icon={<FileSpreadsheet />}>Relatórios</Item>
          {admin && <Item to="/gestao/auditoria" icon={<History />}>Auditoria</Item>}
          {admin && <Item to="/gestao/configuracoes" icon={<Settings />}>Configurações</Item>}
        </div>
      )}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-xl bg-brand text-on-brand"><Timer className="size-5" /></div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold">{company?.name || 'Controle de Ponto'}</p>
        <p className="text-xs text-ink-3">Controle de Ponto</p>
      </div>
    </div>
  );

  const userBox = (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="flex items-center gap-3 px-1">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-ink-2">
          {user?.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-ink-3">{user && ROLE_LABEL[user.role]}</p>
        </div>
      </div>
      <div className="flex gap-1">
        <button onClick={toggle} className="flex-1 rounded-lg p-2 text-ink-2 hover:bg-surface-2" title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} aria-label="Alternar tema">
          {theme === 'dark' ? <Sun className="mx-auto size-4" /> : <Moon className="mx-auto size-4" />}
        </button>
        <button onClick={() => nav('/senha')} className="flex-1 rounded-lg p-2 text-ink-2 hover:bg-surface-2" title="Trocar senha" aria-label="Trocar senha"><KeyRound className="mx-auto size-4" /></button>
        <button onClick={logout} className="flex-1 rounded-lg p-2 text-ink-2 hover:bg-surface-2" title="Sair" aria-label="Sair"><LogOut className="mx-auto size-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-line bg-surface p-4 lg:flex">
        {brand}
        <div className="flex-1 overflow-y-auto">{nav_}</div>
        {userBox}
      </aside>

      <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        {brand}
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-surface-2" aria-label="Abrir menu"><Menu className="size-5" /></button>
      </header>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-surface p-4 shadow-xl">
            <div className="flex items-center justify-between">{brand}<button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-surface-2" aria-label="Fechar menu"><X className="size-5" /></button></div>
            <div className="flex-1 overflow-y-auto">{nav_}</div>
            {userBox}
          </aside>
        </div>
      )}

      <main className="print-full mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
      <footer className="no-print px-4 pb-6 text-center text-xs text-ink-3 lg:text-right lg:pr-8">Software criado por Willian Thomas</footer>
    </div>
  );
}

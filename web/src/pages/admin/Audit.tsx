import { History } from 'lucide-react';
import { useState } from 'react';
import { get } from '../../api';
import { fmtDateTime } from '../../format';
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner, useLoad } from '../../ui';

interface Entry { id: number; action: string; entity: string; entity_id: string | null; data: any; created_at: string; actor: string | null }

const ACTIONS: Record<string, string> = {
  setup: 'Configurou o sistema', login: 'Entrou no sistema', 'password.change': 'Trocou a própria senha',
  'user.create': 'Cadastrou colaborador', 'user.update': 'Alterou cadastro', 'user.reset_password': 'Gerou senha temporária',
  'schedule.save': 'Salvou jornada', 'schedule.delete': 'Removeu jornada', 'punch.create': 'Incluiu marcação', 'punch.delete': 'Desconsiderou marcação',
  'request.create': 'Solicitou ajuste', 'request.approve': 'Aprovou ajuste', 'request.reject': 'Recusou ajuste', 'request.cancel': 'Cancelou solicitação',
  'holiday.save': 'Salvou feriado', 'holiday.delete': 'Removeu feriado', 'holiday.import_national': 'Importou feriados nacionais',
  'absence.create': 'Registrou ausência', 'absence.delete': 'Removeu ausência', 'adjustment.create': 'Lançou no banco de horas', 'adjustment.delete': 'Excluiu lançamento do banco',
  'report.summary': 'Exportou resumo', 'report.timesheet': 'Exportou espelho', 'settings.update': 'Alterou configurações', 'import.planilha': 'Importou planilha antiga',
};

function details(e: Entry) {
  const d = e.data || {};
  const parts: string[] = [];
  if (d.name) parts.push(d.name);
  if (d.date) parts.push(d.date.split('-').reverse().join('/'));
  if (d.time) parts.push(d.time);
  if (d.reason || d.note) parts.push(`“${d.reason || d.note}”`);
  if (e.action === 'login' && d.ip) parts.push(`IP ${d.ip}`);
  if (e.action === 'import.planilha') parts.push(`${d.novos} colaboradores, ${d.marcacoes} marcações`);
  return parts.join(' · ');
}

export default function Audit() {
  const [pages, setPages] = useState<Entry[][]>([]);
  const { data, error, loading } = useLoad<{ entries: Entry[] }>(() => get('/admin/audit?limit=100'), []);
  const [more, setMore] = useState(false);
  const all = [...(data?.entries || []), ...pages.flat()];

  async function loadMore() {
    setMore(true);
    try { const r = await get(`/admin/audit?limit=100&before=${all[all.length - 1].id}`); setPages([...pages, r.entries]); } finally { setMore(false); }
  }

  return (
    <>
      <PageHeader title="Auditoria" subtitle="Registro permanente de quem fez o quê e quando. Nenhuma alteração passa sem rastro." />
      <ErrorBox error={error} />
      <Card pad={false}>
        {loading && !data ? <Spinner /> : !all.length ? <Empty icon={<History className="size-8" />} title="Sem registros" /> : (
          <>
            <ul>{all.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line px-5 py-2.5 text-sm last:border-0">
                <span className="w-32 shrink-0 tabular text-xs text-ink-3">{fmtDateTime(e.created_at)}</span>
                <span className="font-medium">{e.actor || 'Sistema'}</span>
                <span className="text-ink-2">{ACTIONS[e.action] || e.action}</span>
                <span className="min-w-0 flex-1 truncate text-ink-3">{details(e)}</span>
              </li>
            ))}</ul>
            {(data?.entries.length === 100 && (pages.length === 0 || pages[pages.length - 1].length === 100)) && (
              <div className="p-4 text-center"><Button loading={more} onClick={loadMore}>Carregar mais</Button></div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

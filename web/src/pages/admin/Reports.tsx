import { useState } from 'react';
import { useNavigate } from 'react-router';
import { downloadUrl, fmtMonth } from '../../format';
import { Button, Card, Field, PageHeader } from '../../ui';
import { MonthPicker } from '../../ui/timesheet';
import { UserSelect, useUsers } from '../../ui/UserSelect';

export default function Reports() {
  const nav = useNavigate();
  const users = useUsers();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [userId, setUserId] = useState('');
  const ids = userId ? `&ids=${userId}` : '';

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Arquivos compatíveis com Excel e Google Planilhas (separador ponto e vírgula)."
        actions={<MonthPicker value={month} onChange={setMonth} />} />
      <Card className="mb-6">
        <div className="grid max-w-md gap-4">
          <Field label="Colaborador">{(id) => <UserSelect id={id} users={users.data?.users || []} value={userId} onChange={setUserId} allowAll="Todos os colaboradores" />}</Field>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <ReportCard title="Resumo mensal" text={`Uma linha por colaborador com horas, extras, faltas, saldo e banco de ${fmtMonth(month)}.`}
          action={<Button variant="primary" onClick={() => downloadUrl(`/admin/reports/summary.csv?m=${month}${ids}`)}>Baixar CSV</Button>} />
        <ReportCard title="Espelho de ponto" text="Todas as marcações e o resultado de cada dia, prontos para conferência e arquivo."
          action={<Button variant="primary" onClick={() => downloadUrl(`/admin/reports/timesheet.csv?m=${month}${ids}`)}>Baixar CSV</Button>} />
        <ReportCard title="Espelho para assinatura" text="Versão para imprimir ou salvar em PDF, com campos de assinatura do colaborador e do RH."
          action={<Button disabled={!userId} onClick={() => nav(`/gestao/colaboradores/${userId}?m=${month}`)}>{userId ? 'Abrir e imprimir' : 'Escolha um colaborador'}</Button>} />
      </div>
    </>
  );
}

function ReportCard({ title, text, action }: { title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="flex-1 text-sm text-ink-2">{text}</p>
      <div>{action}</div>
    </div>
  );
}

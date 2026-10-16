import { Printer } from 'lucide-react';
import { useState } from 'react';
import { get } from '../api';
import { useAuth } from '../auth';
import { BalanceChart } from '../charts/BalanceChart';
import { fmtMonth } from '../format';
import type { Day, MonthSummary } from '../types';
import { Button, Card, ErrorBox, PageHeader, Spinner, useLoad } from '../ui';
import { RequestModal } from '../ui/RequestModal';
import { DayTable, MonthPicker, SummaryStats } from '../ui/timesheet';

export default function MyTimesheet() {
  const { user, company } = useAuth();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data, error, loading, reload } = useLoad<{ summary: MonthSummary; today: string }>(() => get(`/me/month?m=${month}`), [month]);
  const [day, setDay] = useState<Day | null>(null);

  return (
    <>
      <PageHeader title="Meu espelho de ponto" subtitle={<span>{fmtMonth(month)} · {user?.name}{company ? ` · ${company.name}` : ''}</span>}
        actions={<><MonthPicker value={month} onChange={setMonth} max={data?.today.slice(0, 7)} /><Button onClick={() => print()}><Printer className="size-4" />Imprimir</Button></>} />
      <ErrorBox error={error} />
      {loading && !data ? <Spinner /> : data && (
        <div className="flex flex-col gap-6">
          <SummaryStats s={data.summary} />
          <Card title="Saldo diário" className="no-print"><BalanceChart days={data.summary.days} /></Card>
          <Card title="Dias do mês" pad={false}>
            <DayTable days={data.summary.days} today={data.today}
              renderActions={(d) => d.date <= data.today && d.status !== 'futuro' ? <Button size="sm" variant="ghost" onClick={() => setDay(d)}>Ajustar</Button> : null} />
          </Card>
        </div>
      )}
      <RequestModal open={!!day} onClose={() => setDay(null)} day={day} today={data?.today || ''} onDone={reload} />
    </>
  );
}

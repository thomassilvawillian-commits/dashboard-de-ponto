import { describe, expect, it } from 'vitest';
import { calcBank, calcDay, calcMonth, type CalcContext, type Punch, type UserCalc } from '../src/domain/calc.js';
import { brazilNationalHolidays, easter, zonedToUtc } from '../src/domain/time.js';

const TZ = 'America/Sao_Paulo';
const week = { '0': 0, '1': 480, '2': 480, '3': 480, '4': 480, '5': 480, '6': 0 };

function user(over: Partial<UserCalc> = {}): UserCalc {
  return {
    id: 1, startDate: '2026-01-01', endDate: null, initialBalanceMin: 0, trackTime: true,
    schedules: [{ validFrom: '2026-01-01', dayMinutes: week, expectedStart: '09:00', breakMinutes: 60 }],
    absences: [], adjustments: [], ...over,
  };
}
function ctx(over: Partial<CalcContext> = {}): CalcContext {
  return { tz: TZ, today: '2026-03-20', now: zonedToUtc('2026-03-20', '15:00', TZ), toleranceDailyMin: 10, toleranceLateMin: 5, holidays: new Map(), ...over };
}
let pid = 0;
const p = (date: string, ...times: string[]): Punch[] => times.map((t) => ({ id: ++pid, ts: zonedToUtc(date, t, TZ), source: 'web' }));

describe('fuso horário', () => {
  it('converte horário local de Brasília para UTC', () => {
    expect(zonedToUtc('2026-03-10', '09:00', TZ).toISOString()).toBe('2026-03-10T12:00:00.000Z');
  });
  it('calcula a Páscoa e os feriados nacionais', () => {
    expect(easter(2026)).toBe('2026-04-05');
    const h = brazilNationalHolidays(2026);
    expect(h.find((x) => x.name === 'Sexta-feira Santa')?.date).toBe('2026-04-03');
    expect(h).toHaveLength(10);
  });
});

describe('apuração diária', () => {
  it('dia completo com hora extra', () => {
    const d = calcDay(user(), '2026-03-10', p('2026-03-10', '08:58', '12:00', '13:00', '18:30'), ctx());
    expect(d.status).toBe('completo');
    expect(d.workedMin).toBe(512);
    expect(d.balanceMin).toBe(32);
    expect(d.lateMin).toBe(0);
    expect(d.breakMin).toBe(60);
  });
  it('variação dentro da tolerância diária não gera saldo', () => {
    const d = calcDay(user(), '2026-03-10', p('2026-03-10', '09:00', '12:00', '13:00', '18:08'), ctx());
    expect(d.balanceMin).toBe(0);
  });
  it('atraso acima da tolerância', () => {
    const d = calcDay(user(), '2026-03-10', p('2026-03-10', '09:20', '12:00', '13:00', '18:00'), ctx());
    expect(d.lateMin).toBe(20);
    expect(d.balanceMin).toBe(-20);
  });
  it('falta em dia útil passado sem marcações', () => {
    const d = calcDay(user(), '2026-03-10', [], ctx());
    expect(d.status).toBe('falta');
    expect(d.balanceMin).toBe(-480);
  });
  it('feriado não gera falta; trabalho no feriado vira extra', () => {
    const c = ctx({ holidays: new Map([['2026-03-10', 'Feriado municipal']]) });
    expect(calcDay(user(), '2026-03-10', [], c).status).toBe('feriado');
    const w = calcDay(user(), '2026-03-10', p('2026-03-10', '09:00', '13:00'), c);
    expect(w.balanceMin).toBe(240);
  });
  it('ausência abonada zera a jornada; compensação debita o banco', () => {
    const ferias = user({ absences: [{ startDate: '2026-03-09', endDate: '2026-03-13', type: 'FERIAS' }] });
    expect(calcDay(ferias, '2026-03-10', [], ctx())).toMatchObject({ status: 'ausencia', balanceMin: 0 });
    const comp = user({ absences: [{ startDate: '2026-03-10', endDate: '2026-03-10', type: 'COMPENSACAO' }] });
    expect(calcDay(comp, '2026-03-10', [], ctx())).toMatchObject({ status: 'compensacao', balanceMin: -480 });
  });
  it('marcação ímpar em dia passado fica pendente e sem saldo', () => {
    const d = calcDay(user(), '2026-03-10', p('2026-03-10', '09:00', '12:00', '13:00'), ctx());
    expect(d.status).toBe('incompleto');
    expect(d.balanceMin).toBe(0);
    expect(d.alerts).toContain('marcacao_impar');
  });
  it('dia atual em andamento conta horas até agora', () => {
    const d = calcDay(user(), '2026-03-20', p('2026-03-20', '09:00', '12:00', '13:00'), ctx());
    expect(d.status).toBe('em_andamento');
    expect(d.workedMin).toBe(300);
  });
  it('alerta de intervalo insuficiente e interjornada', () => {
    const d = calcDay(user(), '2026-03-10', p('2026-03-10', '07:00', '12:00', '12:20', '17:00'), ctx(), zonedToUtc('2026-03-09', '22:00', TZ));
    expect(d.alerts).toEqual(expect.arrayContaining(['intervalo_insuficiente', 'interjornada']));
  });
  it('fim de semana é folga e datas fora do período não contam', () => {
    expect(calcDay(user(), '2026-03-14', [], ctx()).status).toBe('folga');
    expect(calcDay(user({ startDate: '2026-03-12' }), '2026-03-10', [], ctx()).status).toBe('fora_periodo');
    expect(calcDay(user(), '2026-03-25', [], ctx()).status).toBe('futuro');
  });
  it('jornada versionada: mudança vale só a partir da data', () => {
    const u = user({ schedules: [
      { validFrom: '2026-01-01', dayMinutes: week, expectedStart: '09:00', breakMinutes: 60 },
      { validFrom: '2026-03-16', dayMinutes: { ...week, '1': 360 }, expectedStart: '09:00', breakMinutes: 15 },
    ] });
    expect(calcDay(u, '2026-03-09', [], ctx()).balanceMin).toBe(-480);
    expect(calcDay(u, '2026-03-16', [], ctx()).balanceMin).toBe(-360);
  });
});

describe('mês e banco de horas', () => {
  it('resume o mês e acumula saldo inicial e ajustes', () => {
    const u = user({ startDate: '2026-03-02', initialBalanceMin: 120, adjustments: [{ date: '2026-03-15', minutes: -60 }] });
    const index = new Map<string, Punch[]>();
    for (let d = 2; d <= 19; d++) {
      const date = `2026-03-${String(d).padStart(2, '0')}`;
      const wd = new Date(date + 'T12:00:00Z').getUTCDay();
      if (wd >= 1 && wd <= 5) index.set(date, p(date, '09:00', '12:00', '13:00', '18:00'));
    }
    index.delete('2026-03-05'); // uma falta
    const s = calcMonth(u, '2026-03', index, ctx());
    expect(s.daysWorked).toBe(13);
    expect(s.absences).toBe(1);
    expect(s.balanceMin).toBe(-480);
    // hoje (20/03) ainda aguardando: sem débito
    expect(s.bankMin).toBe(120 - 60 - 480);
    expect(calcBank(u, '2026-03-04', index, ctx()).balanceMin).toBe(120);
  });
});

/**
 * Cria uma empresa de demonstração com colaboradores e dois meses de marcações.
 * Use apenas num banco vazio:  DATA_DIR=./data-demo npm run demo -w server
 * Acesso: usuário "admin", senha "demo1234" (colaboradores usam a mesma senha).
 */
import { hashPassword } from '../auth/password.js';
import { config } from '../config.js';
import { createDb } from '../db/index.js';
import { addDays, brazilNationalHolidays, eachDay, minuteOfDay, parseHm, weekday, ymdIn, zonedToUtc } from '../domain/time.js';
import { saveSettings } from '../services/settings.js';

const TZ = 'America/Sao_Paulo';
const db = await createDb({ url: config.databaseUrl || undefined, dataDir: config.dataDir });
const [{ n }] = await db.query<{ n: number }>('select count(*)::int as n from users');
if (n > 0) { console.error('O banco já tem dados. Use um DATA_DIR vazio para a demonstração.'); process.exit(1); }

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const jitter = (base: string, spread: number) => {
  const [h, m] = base.split(':').map(Number);
  const t = h * 60 + m + Math.round((rand() - 0.5) * 2 * spread);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const now = new Date();
const today = ymdIn(now, TZ);
const start = addDays(today.slice(0, 8) + '01', -45).slice(0, 8) + '01';
const hash = await hashPassword('demo1234');
await saveSettings(db, { companyName: 'Padaria Bom Grão', timezone: TZ });
for (const y of new Set([start.slice(0, 4), today.slice(0, 4)])) for (const h of brazilNationalHolidays(Number(y))) {
  await db.query('insert into holidays (date, name) values ($1,$2) on conflict do nothing', [h.date, h.name]);
}

const people = [
  { name: 'Ana Ribeiro', username: 'admin', role: 'ADMIN', job: 'Gerente de RH', dept: 'Administrativo', track: false, start: '09:00' },
  { name: 'Bruno Carvalho', username: 'bruno', role: 'GESTOR', job: 'Supervisor de produção', dept: 'Produção', track: true, start: '06:00' },
  { name: 'Carla Mendes', username: 'carla', role: 'FUNCIONARIO', job: 'Confeiteira', dept: 'Produção', track: true, start: '06:00' },
  { name: 'Diego Santos', username: 'diego', role: 'FUNCIONARIO', job: 'Padeiro', dept: 'Produção', track: true, start: '05:00' },
  { name: 'Elisa Moura', username: 'elisa', role: 'FUNCIONARIO', job: 'Atendente', dept: 'Loja', track: true, start: '08:00' },
  { name: 'Fábio Lima', username: 'fabio', role: 'FUNCIONARIO', job: 'Caixa', dept: 'Loja', track: true, start: '09:00' },
  { name: 'Gabriela Rocha', username: 'gabriela', role: 'FUNCIONARIO', job: 'Atendente', dept: 'Loja', track: true, start: '13:00' },
];

const holidays = new Set((await db.query<{ date: string }>('select date from holidays')).map((h) => h.date));
for (const [i, p] of people.entries()) {
  const [u] = await db.query(
    `insert into users (name, username, password_hash, role, job_title, department, start_date, track_time, registration, initial_balance_min)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
    [p.name, p.username, hash, p.role, p.job, p.dept, start, p.track, String(1001 + i), i === 3 ? 240 : 0]);
  const sixDays = p.dept === 'Loja';
  const dayMinutes = { '0': 0, '1': 480, '2': 480, '3': 480, '4': 480, '5': 480, '6': sixDays ? 240 : 0 };
  if (sixDays) for (const d of ['1', '2', '3', '4', '5']) (dayMinutes as any)[d] = 440;
  await db.query('insert into schedules (user_id, valid_from, day_minutes, expected_start) values ($1,$2,$3::jsonb,$4)', [u.id, start, JSON.stringify(dayMinutes), p.start]);
  if (!p.track) continue;
  if (i === 4) await db.query(`insert into absences (user_id, start_date, end_date, type, note) values ($1,$2,$3,'FERIAS','Férias programadas')`, [u.id, addDays(start, 14), addDays(start, 23)]);
  if (i === 2) await db.query(`insert into absences (user_id, start_date, end_date, type, note) values ($1,$2,$2,'ATESTADO','Consulta médica')`, [u.id, addDays(today, -9)]);
  const absent = (await db.query('select start_date, end_date from absences where user_id = $1', [u.id])).map((a) => [a.start_date, a.end_date]);
  for (const date of eachDay(start, today)) {
    const minutes = (dayMinutes as any)[String(weekday(date))];
    if (!minutes || holidays.has(date) || absent.some(([s, e]) => s <= date && date <= e)) continue;
    if (rand() < 0.03) continue; // falta ocasional
    const late = rand() < 0.12 ? 20 : 0;
    const [h, m] = p.start.split(':').map(Number);
    const startMin = h * 60 + m + late;
    const work = minutes + Math.round((rand() - 0.35) * 60);
    const times = minutes > 300
      ? [startMin, startMin + 240, startMin + 300, startMin + 60 + work]
      : [startMin, startMin + work];
    let marks = times.map((t) => jitter(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, 6));
    if (date === today) {
      const nowMin = minuteOfDay(now, TZ);
      marks = marks.filter((t) => parseHm(t)! < nowMin);
    } else if (rand() < 0.02) marks = marks.slice(0, 3); // esquecimento
    for (const t of marks) {
      await db.query('insert into punches (user_id, ts, work_date, source) values ($1,$2,$3,$4)', [u.id, zonedToUtc(date, t, TZ), date, 'web']);
    }
  }
}
const [diego] = await db.query(`select id from users where username = 'diego'`);
await db.query(`insert into punch_requests (user_id, kind, work_date, ts, reason) values ($1,'ADD',$2,$3,'Esqueci de registrar a saída, fui embora às 14h')`,
  [diego.id, addDays(today, -2), zonedToUtc(addDays(today, -2), '14:00', TZ)]);
await db.query(`insert into bank_adjustments (user_id, date, minutes, kind, note) values ($1,$2,-120,'PAGAMENTO','Pagas na folha')`, [diego.id, addDays(today, -20)]);
console.log('Demonstração criada. Entre com usuário "admin" e senha "demo1234".');
await db.close();

/**
 * Importa cadastros e marcações da versão em Google Planilhas.
 *
 *   npm run importar-planilha -- caminho/Controle_de_Ponto.xlsx [--fuso America/Sao_Paulo]
 *
 * Baixe a planilha em Arquivo → Fazer download → Microsoft Excel (.xlsx).
 * Com o banco embutido, pare o servidor antes de importar. Pode ser executado mais de uma vez:
 * colaboradores e marcações já importados são ignorados.
 */
import XLSX from 'xlsx';
import { hashPassword } from '../auth/password.js';
import { config } from '../config.js';
import { createDb } from '../db/index.js';
import { isValidDate, isValidTimeZone, parseHm, ymdIn, zonedToUtc } from '../domain/time.js';
import { audit } from '../services/audit.js';
import { getSettings } from '../services/settings.js';

const DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const fusoIdx = args.indexOf('--fuso');
if (!file) {
  console.error('Uso: npm run importar-planilha -- arquivo.xlsx [--fuso America/Sao_Paulo]');
  process.exit(1);
}

const wb = XLSX.readFile(file, { cellDates: false });
const sheet = (name: string) => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Aba "${name}" não encontrada no arquivo.`);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true, defval: '' });
};

/** Número serial do Excel → partes de data/hora (sem fuso). */
function serialParts(n: number) {
  const ms = Math.round((n - 25569) * 86400_000);
  const d = new Date(ms);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}
function toDate(v: unknown): string {
  if (typeof v === 'number') return serialParts(v).date;
  const s = String(v ?? '').trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return isValidDate(s.slice(0, 10)) ? s.slice(0, 10) : '';
}
function toTime(v: unknown): string | null {
  if (typeof v === 'number') return serialParts(v).time;
  const m = String(v ?? '').match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}
function toInstant(v: unknown, tz: string): Date | null {
  if (typeof v === 'number') { const p = serialParts(v); return zonedToUtc(p.date, p.time, tz); }
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) { const d = new Date(s); return Number.isFinite(d.getTime()) ? d : null; }
  const date = toDate(s), time = toTime(s.slice(10));
  return date && time ? zonedToUtc(date, time, tz) : null;
}

const db = await createDb({ url: config.databaseUrl || undefined, dataDir: config.dataDir });
const settings = await getSettings(db);
const tz = fusoIdx >= 0 ? args[fusoIdx + 1] : settings.timezone;
if (!isValidTimeZone(tz)) throw new Error('Fuso horário inválido: ' + tz);

const funcionarios = sheet('Funcionarios');
const registros = sheet('Registros');
const idMap = new Map<string, number>();
let novos = 0, existentes = 0, marcacoes = 0, ignoradas = 0;

const primeiraData = new Map<string, string>();
for (const r of registros) {
  const id = String(r.FuncionarioID ?? ''), d = toDate(r.Data);
  if (id && d && (!primeiraData.has(id) || d < primeiraData.get(id)!)) primeiraData.set(id, d);
}

await db.tx(async (q) => {
  for (const f of funcionarios) {
    const legacyId = String(f.ID ?? '').trim();
    const nome = String(f.Nome ?? '').trim();
    if (!legacyId || !nome) continue;
    const [existing] = await q.query('select id from users where lower(username) = lower($1)', [nome]);
    if (existing) { idMap.set(legacyId, existing.id); existentes++; continue; }

    const pin = String(f.PIN ?? '').trim();
    const hash = pin.startsWith('sha256$') ? pin : await hashPassword(/^\d{1,3}$/.test(pin) ? pin.padStart(4, '0') : pin || Math.random().toString(36));
    const jornada = Number(String(f.JornadaDiariaHoras ?? '8').replace(',', '.'));
    const minutos = Math.round((Number.isFinite(jornada) && String(f.JornadaDiariaHoras) !== '' ? jornada : 8) * 60);
    const dias = String(f.DiasTrabalho ?? 'SEG,TER,QUA,QUI,SEX').split(',').map((s) => s.trim().toUpperCase());
    const dayMinutes: Record<string, number> = {};
    DAYS.forEach((d, i) => { dayMinutes[String(i)] = dias.includes(d) ? minutos : 0; });
    const almoco = (parseHm(toTime(f.RetornoAlmoco)) ?? 780) - (parseHm(toTime(f.SaidaAlmoco)) ?? 720);
    const inicio = toDate(f.DataInicio) || primeiraData.get(legacyId) || ymdIn(new Date(), tz);
    const fim = toDate(f.DataFim) || null;
    const rh = String(f.Nivel ?? '').toUpperCase() === 'RH';
    const ativo = String(f.Ativo ?? '1').trim() !== '0';

    const [u] = await q.query(
      `insert into users (name, username, password_hash, role, active, start_date, end_date, initial_balance_min, track_time, must_change_password)
       values ($1,$1,$2,$3,$4,$5,$6,$7,$8,true) returning id`,
      [nome, hash, rh ? 'ADMIN' : 'FUNCIONARIO', ativo, inicio, fim, Math.round(Number(f.SaldoInicialMin) || 0), minutos > 0 && dias.some(Boolean)]);
    await q.query('insert into schedules (user_id, valid_from, day_minutes, expected_start, break_minutes) values ($1,$2,$3::jsonb,$4,$5)',
      [u.id, inicio, JSON.stringify(dayMinutes), toTime(f.Entrada), Math.max(0, almoco)]);
    idMap.set(legacyId, u.id);
    novos++;
  }

  for (const r of registros) {
    if (String(r.Status ?? 'APROVADO').toUpperCase() !== 'APROVADO') { ignoradas++; continue; }
    const userId = idMap.get(String(r.FuncionarioID ?? '').trim());
    const ts = toInstant(r.Timestamp, tz);
    if (!userId || !ts) { ignoradas++; continue; }
    const dup = await q.query(`select 1 from punches where user_id = $1 and date_trunc('minute', ts) = date_trunc('minute', $2::timestamptz) and deleted_at is null`, [userId, ts]);
    if (dup.length) { ignoradas++; continue; }
    const origem = String(r.Origem ?? '').toLowerCase() === 'manual' ? 'ajuste' : 'importado';
    await q.query('insert into punches (user_id, ts, work_date, source, note) values ($1,$2,$3,$4,$5)',
      [userId, ts, toDate(r.Data) || ymdIn(ts, tz), origem, String(r.Observacao ?? '').trim() || null]);
    marcacoes++;
  }
  await audit(q, null, 'import.planilha', 'system', null, { arquivo: String(file).split(/[\\/]/).pop(), novos, existentes, marcacoes, ignoradas });
});

console.log(`Importação concluída:
  colaboradores novos:      ${novos}
  já existentes (mantidos): ${existentes}
  marcações importadas:     ${marcacoes}
  linhas ignoradas:         ${ignoradas}

Colaboradores importados entram com o mesmo nome e PIN da planilha e devem trocar a senha no primeiro acesso.`);
await db.close();

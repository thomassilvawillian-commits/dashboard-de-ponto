import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createDb, type Db } from '../src/db/index.js';
import { ymdIn } from '../src/domain/time.js';

let db: Db;
let app: ReturnType<typeof createApp>;
const admin = () => request.agent(app);
let adminAgent: ReturnType<typeof admin>;
let empAgent: ReturnType<typeof admin>;
let empId: number;
const today = () => ymdIn(new Date(), 'America/Sao_Paulo');

// Com TEST_DATABASE_URL, roda contra um PostgreSQL real (o banco é limpo antes).
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const pg = await import('pg');
    const c = new pg.default.Client({ connectionString: url });
    await c.connect();
    await c.query('drop schema public cascade; create schema public;');
    await c.end();
  }
  db = await createDb({ url });
  app = createApp(db, { webDist: null });
  adminAgent = request.agent(app);
  empAgent = request.agent(app);
});
afterAll(async () => { await db.close(); });

describe('fluxo completo da API', () => {
  it('exige configuração inicial e cria o administrador', async () => {
    expect((await request(app).get('/api/auth/setup')).body.needsSetup).toBe(true);
    const r = await adminAgent.post('/api/auth/setup').send({ companyName: 'Acme', timezone: 'America/Sao_Paulo', name: 'Ana Gestora', username: 'ana', password: 'segredo1' });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe('ADMIN');
    expect((await request(app).post('/api/auth/setup').send({ companyName: 'X', timezone: 'America/Sao_Paulo', name: 'Xavier', username: 'xavier', password: 'segredo1' })).status).toBe(409);
  });

  it('bloqueia acesso sem sessão e rejeita senha errada', async () => {
    expect((await request(app).get('/api/me/today')).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ username: 'ana', password: 'errada' })).status).toBe(401);
  });

  it('administrador cadastra colaborador com senha temporária', async () => {
    const r = await adminAgent.post('/api/admin/users').send({
      name: 'Bruno Silva', username: 'bruno', role: 'FUNCIONARIO', startDate: '2026-01-01', department: 'Operações',
      schedule: { dayMinutes: { '1': 480, '2': 480, '3': 480, '4': 480, '5': 480 }, expectedStart: '08:00', breakMinutes: 60 },
    });
    expect(r.status).toBe(201);
    expect(r.body.temporaryPassword).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
    empId = r.body.user.id;
    const login = await empAgent.post('/api/auth/login').send({ username: 'BRUNO', password: r.body.temporaryPassword });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
    const ch = await empAgent.post('/api/auth/password').send({ current: r.body.temporaryPassword, next: 'novaSenha9' });
    expect(ch.status).toBe(200);
  });

  it('colaborador não acessa a área administrativa', async () => {
    expect((await empAgent.get('/api/admin/overview')).status).toBe(403);
  });

  it('registra ponto e impede marcação duplicada imediata', async () => {
    const r = await empAgent.post('/api/me/punch').send({});
    expect(r.status).toBe(201);
    expect(r.body.punch.label).toBe('Entrada');
    expect((await empAgent.post('/api/me/punch').send({})).status).toBe(409);
    const t = await empAgent.get('/api/me/today');
    expect(t.body.day.punches).toHaveLength(1);
    expect(t.body.next.label).toBe('Saída para intervalo');
  });

  it('solicitação de ajuste passa pela aprovação do gestor', async () => {
    const r = await empAgent.post('/api/me/requests').send({ kind: 'ADD', date: '2026-02-02', time: '08:00', reason: 'Esqueci de marcar' });
    expect(r.status).toBe(201);
    expect(r.body.request.status).toBe('PENDENTE');
    const list = await adminAgent.get('/api/admin/requests');
    expect(list.body.requests).toHaveLength(1);
    expect((await adminAgent.post(`/api/admin/requests/${r.body.request.id}/approve`).send({})).status).toBe(200);
    const month = await empAgent.get('/api/me/month?m=2026-02');
    const day = month.body.summary.days.find((d: any) => d.date === '2026-02-02');
    expect(day.punches.map((p: any) => p.time)).toEqual(['08:00']);
    expect(day.status).toBe('incompleto');
    expect((await adminAgent.post(`/api/admin/requests/${r.body.request.id}/approve`).send({})).status).toBe(409);
  });

  it('gestor lança marcações, feriados, ausências e ajustes de banco', async () => {
    for (const time of ['12:00', '13:00', '17:00']) {
      expect((await adminAgent.post(`/api/admin/users/${empId}/punches`).send({ date: '2026-02-02', time, note: 'Correção' })).status).toBe(201);
    }
    expect((await adminAgent.post('/api/admin/holidays/national').send({ year: 2026 })).body.added).toBe(10);
    expect((await adminAgent.post('/api/admin/absences').send({ userId: empId, startDate: '2026-02-09', endDate: '2026-02-13', type: 'FERIAS' })).status).toBe(201);
    expect((await adminAgent.post('/api/admin/adjustments').send({ userId: empId, date: '2026-02-27', minutes: 120, kind: 'CORRECAO', note: 'Saldo anterior' })).status).toBe(201);
    const m = await adminAgent.get(`/api/admin/users/${empId}/month?m=2026-02`);
    const s = m.body.summary;
    expect(s.days.find((d: any) => d.date === '2026-02-02')).toMatchObject({ status: 'completo', workedMin: 480, balanceMin: 0 });
    expect(s.days.find((d: any) => d.date === '2026-02-10').status).toBe('ausencia');
    expect(s.daysWorked).toBe(1);
  });

  it('painel gerencial, relatórios e auditoria', async () => {
    const o = await adminAgent.get(`/api/admin/overview?m=${today().slice(0, 7)}`);
    expect(o.status).toBe(200);
    const bruno = o.body.team.find((t: any) => t.id === empId);
    expect(bruno.today.presence).toBe('trabalhando');
    expect(o.body.series.length).toBeGreaterThan(27);
    const csv = await adminAgent.get('/api/admin/reports/timesheet.csv?m=2026-02');
    expect(csv.status).toBe(200);
    expect(csv.text.startsWith('﻿Colaborador;')).toBe(true);
    expect(csv.text).toContain('02/02/2026;Seg;Completo;08:00 12:00 13:00 17:00');
    const audit = await adminAgent.get('/api/admin/audit');
    expect(audit.body.entries.length).toBeGreaterThan(5);
  });

  it('gestor não corrige o próprio ponto nem aprova a própria solicitação', async () => {
    const g = await adminAgent.post('/api/admin/users').send({ name: 'Gil Gestor', username: 'gil', role: 'GESTOR', startDate: '2026-01-01', password: 'gestor123' });
    const gestor = request.agent(app);
    await gestor.post('/api/auth/login').send({ username: 'gil', password: 'gestor123' });
    expect((await gestor.post(`/api/admin/users/${g.body.user.id}/punches`).send({ date: '2026-02-03', time: '08:00', note: 'Ajuste' })).status).toBe(403);
    expect((await gestor.post(`/api/admin/users/${empId}/punches`).send({ date: '2026-02-03', time: '08:00', note: 'Ajuste' })).status).toBe(201);
    const r = await gestor.post('/api/me/requests').send({ kind: 'ADD', date: '2026-02-03', time: '08:00', reason: 'Esqueci de marcar' });
    expect((await gestor.post(`/api/admin/requests/${r.body.request.id}/approve`).send({})).status).toBe(403);
    expect((await gestor.patch(`/api/admin/users/${empId}`).send({ role: 'ADMIN' })).status).toBe(403);
  });

  it('não permite remover o último administrador', async () => {
    const me = await adminAgent.get('/api/auth/me');
    const r = await adminAgent.patch(`/api/admin/users/${me.body.user.id}`).send({ role: 'GESTOR' });
    expect(r.status).toBe(400);
  });

  it('aceita o hash de PIN da versão em planilha e converte no login', async () => {
    const crypto = await import('node:crypto');
    const salt = 'abc-123';
    const legacy = 'sha256$' + salt + '$' + crypto.createHash('sha256').update(salt + ':1234').digest('hex');
    await db.query(`insert into users (name, username, password_hash) values ('Legado', 'LEGADO', $1)`, [legacy]);
    const r = await request(app).post('/api/auth/login').send({ username: 'legado', password: '1234' });
    expect(r.status).toBe(200);
    const [u] = await db.query(`select password_hash from users where username = 'LEGADO'`);
    expect(u.password_hash.startsWith('scrypt$')).toBe(true);
  });
});

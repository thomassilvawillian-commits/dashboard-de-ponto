import type { Db } from './index.js';

/** Cada migração roda uma única vez, em ordem. Nunca altere uma migração já publicada. */
const MIGRATIONS: string[] = [
  `
  create table settings (
    key text primary key,
    value jsonb not null
  );

  create table users (
    id serial primary key,
    name text not null,
    username text not null,
    email text,
    password_hash text not null,
    role text not null default 'FUNCIONARIO' check (role in ('ADMIN','GESTOR','FUNCIONARIO')),
    active boolean not null default true,
    registration text,
    department text,
    job_title text,
    start_date date not null default current_date,
    end_date date,
    initial_balance_min integer not null default 0,
    track_time boolean not null default true,
    must_change_password boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create unique index users_username_uq on users (lower(username));

  create table schedules (
    id serial primary key,
    user_id integer not null references users(id) on delete cascade,
    valid_from date not null,
    day_minutes jsonb not null,
    expected_start text,
    break_minutes integer not null default 60,
    created_at timestamptz not null default now(),
    unique (user_id, valid_from)
  );

  create table punches (
    id serial primary key,
    user_id integer not null references users(id) on delete cascade,
    ts timestamptz not null,
    work_date date not null,
    source text not null default 'web',
    note text,
    ip text,
    user_agent text,
    latitude double precision,
    longitude double precision,
    accuracy double precision,
    created_by integer references users(id),
    created_at timestamptz not null default now(),
    deleted_at timestamptz,
    deleted_by integer references users(id),
    delete_reason text
  );
  create index punches_user_date on punches (user_id, work_date) where deleted_at is null;

  create table punch_requests (
    id serial primary key,
    user_id integer not null references users(id) on delete cascade,
    kind text not null check (kind in ('ADD','REMOVE')),
    work_date date not null,
    ts timestamptz,
    punch_id integer references punches(id),
    reason text,
    status text not null default 'PENDENTE' check (status in ('PENDENTE','APROVADO','REJEITADO','CANCELADO')),
    decided_by integer references users(id),
    decided_at timestamptz,
    decision_note text,
    created_at timestamptz not null default now()
  );
  create index punch_requests_status on punch_requests (status, created_at);

  create table holidays (
    id serial primary key,
    date date not null unique,
    name text not null,
    created_at timestamptz not null default now()
  );

  create table absences (
    id serial primary key,
    user_id integer not null references users(id) on delete cascade,
    start_date date not null,
    end_date date not null,
    type text not null,
    note text,
    created_by integer references users(id),
    created_at timestamptz not null default now(),
    check (end_date >= start_date)
  );

  create table bank_adjustments (
    id serial primary key,
    user_id integer not null references users(id) on delete cascade,
    date date not null,
    minutes integer not null,
    kind text not null,
    note text,
    created_by integer references users(id),
    created_at timestamptz not null default now()
  );

  create table sessions (
    id text primary key,
    user_id integer not null references users(id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    ip text,
    user_agent text
  );

  create table audit_log (
    id bigserial primary key,
    actor_id integer references users(id) on delete set null,
    action text not null,
    entity text,
    entity_id text,
    data jsonb,
    created_at timestamptz not null default now()
  );
  create index audit_log_created on audit_log (created_at desc);
  `,
];

export async function migrate(db: Db) {
  await db.exec(`create table if not exists schema_migrations (
    version integer primary key,
    applied_at timestamptz not null default now()
  )`);
  const done = new Set((await db.query<{ version: number }>('select version from schema_migrations')).map((r) => r.version));
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const version = i + 1;
    if (done.has(version)) continue;
    await db.tx(async (q) => {
      for (const stmt of splitStatements(MIGRATIONS[i])) await q.query(stmt);
      await q.query('insert into schema_migrations (version) values ($1)', [version]);
    });
  }
}

function splitStatements(sql: string) {
  return sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
}

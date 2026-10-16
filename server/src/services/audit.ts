import type { Queryable } from '../db/index.js';

export async function audit(q: Queryable, actorId: number | null, action: string, entity: string, entityId: string | number | null, data?: unknown) {
  await q.query('insert into audit_log (actor_id, action, entity, entity_id, data) values ($1,$2,$3,$4,$5::jsonb)',
    [actorId, action, entity, entityId == null ? null : String(entityId), data === undefined ? null : JSON.stringify(data)]);
}

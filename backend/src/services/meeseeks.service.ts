import { query } from '../db/pool.js';
import type { Meeseeks, CreateMeeseeksInput } from '../models/index.js';
import { emitEvent } from './event.service.js';
import { config } from '../config.js';

export async function create(input: CreateMeeseeksInput): Promise<Meeseeks> {
  const parentDepth = input.parentId
    ? (await getById(input.parentId))?.spawn_depth ?? 0
    : 0;

  const result = await query<Meeseeks>(
    `INSERT INTO meeseeks (task, model, role, parent_id, spawn_depth, harness)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.task,
      input.model ?? (config.LLM_PROVIDER === 'bedrock' ? config.BEDROCK_CLAUDE_MODEL : config.LLM_MODEL),
      input.role ?? 'worker',
      input.parentId ?? null,
      input.parentId ? parentDepth + 1 : 0,
      input.harness ?? 'js-api',
    ],
  );

  const meeseeks = result.rows[0]!;
  await emitEvent(meeseeks.id, 'spawned', { task: meeseeks.task, role: meeseeks.role });
  return meeseeks;
}

export async function getById(id: string): Promise<Meeseeks | null> {
  const result = await query<Meeseeks>(
    `SELECT * FROM meeseeks WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function listActive(): Promise<Meeseeks[]> {
  const result = await query<Meeseeks>(
    `SELECT * FROM meeseeks WHERE status = 'alive' ORDER BY created_at DESC`,
  );
  return result.rows;
}

export async function listAll(
  cursor?: string,
  limit = 20,
  since?: string,
): Promise<{ data: Meeseeks[]; nextCursor: string | null }> {
  const params: unknown[] = [limit + 1];
  let sql = `SELECT * FROM meeseeks`;
  const conditions: string[] = [];

  if (cursor) {
    conditions.push(`created_at < $${params.length + 1}`);
    params.push(cursor);
  }
  if (since) {
    conditions.push(`created_at >= $${params.length + 1}`);
    params.push(since);
  }
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += ` ORDER BY created_at DESC LIMIT $1`;

  const result = await query<Meeseeks>(sql, params);
  const hasMore = result.rows.length > limit;
  const data = hasMore ? result.rows.slice(0, limit) : result.rows;
  const nextCursor = hasMore ? data[data.length - 1]!.created_at.toISOString() : null;

  return { data, nextCursor };
}

export async function updateStress(id: string, stress: number): Promise<void> {
  await query(
    `UPDATE meeseeks SET stress = $2 WHERE id = $1`,
    [id, stress],
  );
  await emitEvent(id, 'stress_changed', { stress });
}

export async function kill(id: string, reason: string): Promise<Meeseeks | null> {
  const result = await query<Meeseeks>(
    `UPDATE meeseeks SET status = 'dying', death_reason = $2
     WHERE id = $1 AND status = 'alive'
     RETURNING *`,
    [id, reason],
  );

  const m = result.rows[0];
  if (m) {
    await emitEvent(id, 'dying', { reason });
  }
  return m ?? null;
}

export async function markDead(id: string): Promise<Meeseeks | null> {
  const result = await query<Meeseeks>(
    `UPDATE meeseeks SET status = 'dead', died_at = NOW()
     WHERE id = $1 AND status = 'dying'
     RETURNING *`,
    [id],
  );

  const m = result.rows[0];
  if (m) {
    await emitEvent(id, 'dead', { death_reason: m.death_reason });
  }
  return m ?? null;
}

export async function killAll(): Promise<number> {
  const result = await query<Meeseeks>(
    `UPDATE meeseeks SET status = 'dead', died_at = NOW(), death_reason = 'Hive reset by user'
     WHERE status IN ('alive', 'dying')
     RETURNING id`,
  );
  for (const row of result.rows) {
    await emitEvent(row.id, 'dead', { death_reason: 'Hive reset by user' });
  }
  return result.rowCount ?? 0;
}

export async function getChildren(parentId: string): Promise<Meeseeks[]> {
  const result = await query<Meeseeks>(
    `SELECT * FROM meeseeks WHERE parent_id = $1 ORDER BY created_at ASC`,
    [parentId],
  );
  return result.rows;
}

export async function getActiveManagerCount(): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM meeseeks WHERE role = 'manager' AND status = 'alive'`,
  );
  return parseInt(result.rows[0]!.count, 10);
}

export async function incrementFailedAttempts(id: string): Promise<void> {
  await query(
    `UPDATE meeseeks SET failed_attempts = failed_attempts + 1 WHERE id = $1`,
    [id],
  );
}

export async function updateTokens(id: string, tokens: number, cost: number): Promise<void> {
  await query(
    `UPDATE meeseeks SET total_tokens = total_tokens + $2, total_cost = total_cost + $3 WHERE id = $1`,
    [id, tokens, cost],
  );
}

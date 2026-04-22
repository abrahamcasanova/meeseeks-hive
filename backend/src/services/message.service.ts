import { query } from '../db/pool.js';
import type { Message, MessageRole } from '../models/index.js';

export async function create(
  meeseeksId: string,
  role: MessageRole,
  content: string,
  tokensUsed = 0,
  cost = 0,
  model: string | null = null,
): Promise<Message> {
  const result = await query<Message>(
    `INSERT INTO messages (meeseeks_id, role, content, tokens_used, cost, model)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [meeseeksId, role, content, tokensUsed, cost, model],
  );
  return result.rows[0]!;
}

export async function getRecent(meeseeksId: string, limit = 5): Promise<Message[]> {
  const result = await query<Message>(
    `SELECT * FROM messages
     WHERE meeseeks_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [meeseeksId, limit],
  );
  return result.rows.reverse();
}

export async function listPaginated(
  meeseeksId: string,
  cursor?: string,
  limit = 20,
): Promise<{ data: Message[]; nextCursor: string | null }> {
  const params: unknown[] = [meeseeksId, limit + 1];
  let sql = `SELECT * FROM messages WHERE meeseeks_id = $1`;

  if (cursor) {
    sql += ` AND created_at < $3`;
    params.push(cursor);
  }

  sql += ` ORDER BY created_at DESC LIMIT $2`;

  const result = await query<Message>(sql, params);
  const hasMore = result.rows.length > limit;
  const data = hasMore ? result.rows.slice(0, limit) : result.rows;
  const nextCursor = hasMore ? data[data.length - 1]!.created_at.toISOString() : null;

  return { data: data.reverse(), nextCursor };
}

export async function getAll(meeseeksId: string): Promise<Message[]> {
  const result = await query<Message>(
    `SELECT * FROM messages WHERE meeseeks_id = $1 ORDER BY created_at ASC`,
    [meeseeksId],
  );
  return result.rows;
}

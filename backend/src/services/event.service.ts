import { query } from '../db/pool.js';
import type { EventType, MeeseeksEvent } from '../models/index.js';

export async function emitEvent(
  meeseeksId: string,
  eventType: EventType,
  payload: Record<string, unknown> = {},
): Promise<MeeseeksEvent> {
  const result = await query<MeeseeksEvent>(
    `INSERT INTO events (meeseeks_id, event_type, payload)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [meeseeksId, eventType, JSON.stringify(payload)],
  );
  return result.rows[0]!;
}

export async function getEvents(meeseeksId: string): Promise<MeeseeksEvent[]> {
  const result = await query<MeeseeksEvent>(
    `SELECT * FROM events WHERE meeseeks_id = $1 ORDER BY created_at ASC`,
    [meeseeksId],
  );
  return result.rows;
}

export async function getEventsSince(
  meeseeksId: string,
  sinceId: number,
): Promise<MeeseeksEvent[]> {
  const result = await query<MeeseeksEvent>(
    `SELECT * FROM events WHERE meeseeks_id = $1 AND id > $2 ORDER BY created_at ASC`,
    [meeseeksId, sinceId],
  );
  return result.rows;
}

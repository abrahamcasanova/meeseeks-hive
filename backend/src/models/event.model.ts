import { z } from 'zod';

export const EventType = z.enum([
  'spawned',
  'message_sent',
  'message_received',
  'stress_changed',
  'strategy_updated',
  'memory_injected',
  'sub_spawned',
  'race_lost',
  'dying',
  'dead',
]);
export type EventType = z.infer<typeof EventType>;

export const MeeseeksEventSchema = z.object({
  id: z.coerce.number(),
  meeseeks_id: z.string().uuid(),
  event_type: EventType,
  payload: z.record(z.unknown()),
  created_at: z.coerce.date(),
});
export type MeeseeksEvent = z.infer<typeof MeeseeksEventSchema>;

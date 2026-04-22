import { z } from 'zod';

export const MeeseeksStatus = z.enum(['alive', 'dying', 'dead']);
export type MeeseeksStatus = z.infer<typeof MeeseeksStatus>;

export const MeeseeksRole = z.enum(['worker', 'manager']);
export type MeeseeksRole = z.infer<typeof MeeseeksRole>;

export const CreateMeeseeksSchema = z.object({
  task: z.string().min(1).max(2000),
  model: z.string().optional(),
  role: MeeseeksRole.optional(),
  parentId: z.string().uuid().optional(),
  harness: z.string().optional(),
});
export type CreateMeeseeksInput = z.infer<typeof CreateMeeseeksSchema>;

export const MeeseeksSchema = z.object({
  id: z.string().uuid(),
  task: z.string(),
  status: MeeseeksStatus,
  role: MeeseeksRole,
  model: z.string(),
  strategy: z.string().nullable(),
  parent_id: z.string().uuid().nullable(),
  spawn_depth: z.number().int(),
  stress: z.number(),
  failed_attempts: z.number().int(),
  lost_race: z.boolean(),
  inherited_strategy_failed: z.boolean(),
  harness: z.string().default('js-api'),
  created_at: z.coerce.date(),
  died_at: z.coerce.date().nullable(),
  death_reason: z.string().nullable(),
  total_tokens: z.number().int(),
  total_cost: z.number(),
});
export type Meeseeks = z.infer<typeof MeeseeksSchema>;

export const MAX_SPAWN_DEPTH = 2;
export const MAX_ACTIVE_MANAGERS = 1;

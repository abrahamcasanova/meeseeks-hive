import { z } from 'zod';

export const CostEntrySchema = z.object({
  id: z.coerce.number().optional(),
  meeseeks_id: z.string().uuid(),
  model: z.string(),
  input_tokens: z.number().int(),
  output_tokens: z.number().int(),
  cost: z.number(),
  created_at: z.coerce.date().optional(),
});
export type CostEntry = z.infer<typeof CostEntrySchema>;

export interface CostSummary {
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  entries_count: number;
}

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
  'claude-haiku-4-5': { input: 0.80 / 1_000_000, output: 4.0 / 1_000_000 },
  'claude-opus-4-7': { input: 15.0 / 1_000_000, output: 75.0 / 1_000_000 },
};

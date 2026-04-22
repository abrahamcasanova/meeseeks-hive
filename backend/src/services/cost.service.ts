import { query } from '../db/pool.js';
import { MODEL_PRICING, type CostEntry, type CostSummary } from '../models/index.js';
import * as meeseeksService from './meeseeks.service.js';

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-sonnet-4-6']!;
  return inputTokens * pricing.input + outputTokens * pricing.output;
}

export async function record(entry: Omit<CostEntry, 'id' | 'created_at'>): Promise<void> {
  await query(
    `INSERT INTO cost_ledger (meeseeks_id, model, input_tokens, output_tokens, cost)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.meeseeks_id, entry.model, entry.input_tokens, entry.output_tokens, entry.cost],
  );

  const totalTokens = entry.input_tokens + entry.output_tokens;
  await meeseeksService.updateTokens(entry.meeseeks_id, totalTokens, entry.cost);
}

export async function getMeeseeksCost(meeseeksId: string): Promise<CostSummary> {
  const result = await query<{
    total_input: string;
    total_output: string;
    total_cost: string;
    count: string;
  }>(
    `SELECT
       COALESCE(SUM(input_tokens), 0) as total_input,
       COALESCE(SUM(output_tokens), 0) as total_output,
       COALESCE(SUM(cost), 0) as total_cost,
       COUNT(*) as count
     FROM cost_ledger WHERE meeseeks_id = $1`,
    [meeseeksId],
  );

  const row = result.rows[0]!;
  const totalInput = parseInt(row.total_input, 10);
  const totalOutput = parseInt(row.total_output, 10);

  return {
    total_tokens: totalInput + totalOutput,
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    total_cost: parseFloat(row.total_cost),
    entries_count: parseInt(row.count, 10),
  };
}

export async function getGlobalCost(): Promise<CostSummary> {
  const result = await query<{
    total_input: string;
    total_output: string;
    total_cost: string;
    count: string;
  }>(
    `SELECT
       COALESCE(SUM(input_tokens), 0) as total_input,
       COALESCE(SUM(output_tokens), 0) as total_output,
       COALESCE(SUM(cost), 0) as total_cost,
       COUNT(*) as count
     FROM cost_ledger`,
  );

  const row = result.rows[0]!;
  const totalInput = parseInt(row.total_input, 10);
  const totalOutput = parseInt(row.total_output, 10);

  return {
    total_tokens: totalInput + totalOutput,
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    total_cost: parseFloat(row.total_cost),
    entries_count: parseInt(row.count, 10),
  };
}

export type MeeseeksStatus = 'alive' | 'dying' | 'dead';
export type MeeseeksRole = 'worker' | 'manager';
export type StressLabel = 'eager' | 'concerned' | 'anxious' | 'stressed' | 'panicked';

export interface Meeseeks {
  id: string;
  task: string;
  status: MeeseeksStatus;
  role: MeeseeksRole;
  model: string;
  strategy: string | null;
  parent_id: string | null;
  spawn_depth: number;
  stress: number;
  failed_attempts: number;
  lost_race: boolean;
  inherited_strategy_failed: boolean;
  harness: string;
  created_at: string;
  died_at: string | null;
  death_reason: string | null;
  total_tokens: number;
  total_cost: number;
}

export interface Message {
  id: string;
  meeseeks_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used: number;
  cost: number;
  model: string | null;
  created_at: string;
}

export interface MeeseeksEvent {
  id: number;
  meeseeks_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CostSummary {
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  entries_count: number;
}

export type WsEvent =
  | { type: 'meeseeks:spawned'; data: Meeseeks }
  | { type: 'meeseeks:updated'; data: Partial<Meeseeks> & { id: string } }
  | { type: 'meeseeks:stress'; data: { id: string; stress: number; label: string } }
  | { type: 'meeseeks:dying'; data: { id: string; reason: string } }
  | { type: 'meeseeks:dead'; data: { id: string; reason: string } }
  | { type: 'message:new'; data: { meeseeksId: string; message: Message } }
  | { type: 'cost:update'; data: CostSummary }
  | { type: 'hive:snapshot'; data: Meeseeks[] }
  | { type: 'race:started'; data: { parentId: string; competitors: string[]; task: string } }
  | { type: 'race:finished'; data: { winnerId: string; loserId: string; reason: string } }
  | { type: 'meeseeks:memory_injected'; data: { id: string; strategies: { name: string; avg: number; wins: number }[]; iteration: number } };

// Performance Report Types
export type Environment = 'easy' | 'medium' | 'random' | 'hard' | 'chaos';

export interface IterationResult {
  iter: number;
  env: Environment;
  strategy: string;
  requests: number;
  retries: number;
  time: number;
  score: number;
  reason?: string;
}

export interface BaselineResult {
  scores: number[];
  avg: number;
  failures: number;
}

export interface SystemResult {
  avg: number;
  failures: number;
}

export interface PerformanceReport {
  table: IterationResult[];
  baseline: BaselineResult | null;
  system: SystemResult;
  comparison: {
    improvement: string;
    meetsTarget: boolean;
  };
  winnerCode: {
    code: string;
    strategy: string;
    score: number;
    iteration: number;
  } | null;
}

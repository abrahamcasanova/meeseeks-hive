import type { Meeseeks, Message, CostSummary } from '../models/index.js';

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
  | { type: 'race:finished'; data: { winnerId: string; loserId: string; reason: string; scores: Record<string, number> } }
  | { type: 'meeseeks:memory_injected'; data: { id: string; strategies: { name: string; avg: number; wins: number; sourceId?: string }[]; ancestry: string[]; iteration: number } };

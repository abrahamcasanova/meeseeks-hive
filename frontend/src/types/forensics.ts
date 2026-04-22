import type { Meeseeks, Message, MeeseeksEvent, CostSummary } from './meeseeks';

export interface ForensicsReport {
  meeseeks: Meeseeks;
  messages: Message[];
  events: MeeseeksEvent[];
  cost: CostSummary;
  children: Meeseeks[];
  stressTimeline: Array<{ timestamp: string; stress: number }>;
  lifespan: number;
}

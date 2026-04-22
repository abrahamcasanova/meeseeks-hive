import * as meeseeksService from './meeseeks.service.js';
import * as messageService from './message.service.js';
import * as eventService from './event.service.js';
import * as costService from './cost.service.js';
import type { Meeseeks, Message, MeeseeksEvent, CostSummary } from '../models/index.js';

export interface ForensicsReport {
  meeseeks: Meeseeks;
  messages: Message[];
  events: MeeseeksEvent[];
  cost: CostSummary;
  children: Meeseeks[];
  stressTimeline: Array<{ timestamp: string; stress: number }>;
  lifespan: number;
}

export async function getForensicsReport(meeseeksId: string): Promise<ForensicsReport | null> {
  const meeseeks = await meeseeksService.getById(meeseeksId);
  if (!meeseeks) return null;

  const [messages, events, cost, children] = await Promise.all([
    messageService.getAll(meeseeksId),
    eventService.getEvents(meeseeksId),
    costService.getMeeseeksCost(meeseeksId),
    meeseeksService.getChildren(meeseeksId),
  ]);

  const stressTimeline = events
    .filter(e => e.event_type === 'stress_changed')
    .map(e => ({
      timestamp: new Date(e.created_at).toISOString(),
      stress: (e.payload as { stress?: number }).stress ?? 0,
    }));

  const createdAt = new Date(meeseeks.created_at).getTime();
  const diedAt = meeseeks.died_at ? new Date(meeseeks.died_at).getTime() : Date.now();
  const lifespan = diedAt - createdAt;

  return {
    meeseeks,
    messages,
    events,
    cost,
    children,
    stressTimeline,
    lifespan,
  };
}

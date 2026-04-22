import { apiGet, apiPost, apiDelete } from './api';
import type { Meeseeks, Message, MeeseeksEvent, CostSummary, PerformanceReport } from '../types';

export interface HarnessPlugin {
  id: string;
  name: string;
  description: string;
  exampleTask: string;
}

export function listPlugins() {
  return apiGet<HarnessPlugin[]>('/plugins');
}

export function createMeeseeks(input: { task: string; model?: string; role?: string; harness?: string }) {
  return apiPost<Meeseeks>('/meeseeks', input);
}

export function getMeeseeks(id: string) {
  return apiGet<Meeseeks>(`/meeseeks/${id}`);
}

export function listActive() {
  return apiGet<Meeseeks[]>('/meeseeks/active');
}

export function listAll(limit = 50) {
  return apiGet<{ data: Meeseeks[]; nextCursor: string | null }>(`/meeseeks?limit=${limit}`);
}

export function listSession(since: string, limit = 50) {
  return apiGet<{ data: Meeseeks[]; nextCursor: string | null }>(`/meeseeks?limit=${limit}&since=${encodeURIComponent(since)}`);
}

export function killMeeseeks(id: string, reason = 'Destroyed by user') {
  return apiDelete<Meeseeks>(`/meeseeks/${id}`, { reason });
}

export function killAllMeeseeks() {
  return apiDelete<{ killed: number }>('/meeseeks/all');
}

export function startRace(task: string, harness?: string) {
  return apiPost<{ parentId: string; competitors: string[] }>('/meeseeks/race', { task, harness });
}

export function sendMessage(id: string, content: string) {
  return apiPost<{ message: Message; usage: { inputTokens: number; outputTokens: number; cost: number } }>(
    `/meeseeks/${id}/message`,
    { content },
  );
}

export function getMessages(id: string, cursor?: string) {
  const params = cursor ? `?cursor=${cursor}` : '';
  return apiGet<{ data: Message[]; nextCursor: string | null }>(`/meeseeks/${id}/messages${params}`);
}

export function getEvents(id: string) {
  return apiGet<MeeseeksEvent[]>(`/meeseeks/${id}/events`);
}

export function getGlobalCosts() {
  return apiGet<CostSummary>('/costs');
}

export function getMeeseeksCost(id: string) {
  return apiGet<CostSummary>(`/costs/${id}`);
}

export function getPerformanceReport(id: string) {
  return apiGet<PerformanceReport>(`/meeseeks/${id}/report`);
}

import { apiGet } from './api';

export interface RuntimeConfig {
  minIterations: number;
  maxIterations: number;
  thinkIntervalMs: number;
  ageFactor: number;
  failureFactor: number;
  raceFactor: number;
  inheritedFactor: number;
  lowScorePenalty: number;
  midScorePenalty: number;
  maxAgeSec: number;
  maxFailures: number;
  spawnStressThreshold: number;
  deathThreshold: number;
  competitorThreshold: number;
  stressBoostPerChildIter: number;
  maxStressBoostFromChild: number;
  maxTokensPerMeeseeks: number;
}

export function getConfig(): Promise<RuntimeConfig> {
  return apiGet<RuntimeConfig>('/config');
}

export async function patchConfig(patch: Partial<RuntimeConfig>): Promise<RuntimeConfig> {
  const res = await fetch('/api/v1/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function resetConfig(): Promise<RuntimeConfig> {
  const res = await fetch('/api/v1/config/reset', { method: 'POST' });
  return res.json();
}

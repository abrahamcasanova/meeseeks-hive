export interface RuntimeConfig {
  // Iteraciones
  minIterations: number;        // default 2
  maxIterations: number;        // default 8
  thinkIntervalMs: number;      // default 8000

  // Estrés — factores de la fórmula
  ageFactor: number;            // default 0.35
  failureFactor: number;        // default 0.30
  raceFactor: number;           // default 0.15
  inheritedFactor: number;      // default 0.10
  lowScorePenalty: number;      // default 0.12 (score ≤ 4)
  midScorePenalty: number;      // default 0.06 (score 5-7)
  maxAgeSec: number;            // default 180
  maxFailures: number;          // default 6

  // Umbrales de comportamiento
  spawnStressThreshold: number; // default 0.50 — a qué % de estrés spawnea sub-agente
  deathThreshold: number;       // default 1.00 — a qué % muere
  competitorThreshold: number;  // default 0.70 — a qué % lanza competidor

  // Sub-agentes
  stressBoostPerChildIter: number; // default 0.08
  maxStressBoostFromChild: number; // default 0.30

  // Tokens y costo
  maxTokensPerMeeseeks: number; // default 10000
  maxTokensFreeMeeseeks: number; // default 50000 — higher budget for free-mode (verbose text responses)
}

const DEFAULTS: RuntimeConfig = {
  minIterations: 2,
  maxIterations: 8,
  thinkIntervalMs: 8000,

  ageFactor: 0.35,
  failureFactor: 0.30,
  raceFactor: 0.15,
  inheritedFactor: 0.10,
  lowScorePenalty: 0.12,
  midScorePenalty: 0.06,
  maxAgeSec: 180,
  maxFailures: 6,

  spawnStressThreshold: 0.50,
  deathThreshold: 1.00,
  competitorThreshold: 0.70,

  stressBoostPerChildIter: 0.08,
  maxStressBoostFromChild: 0.30,

  maxTokensPerMeeseeks: 10000,
  maxTokensFreeMeeseeks: 50000,
};

let current: RuntimeConfig = { ...DEFAULTS };

export function getConfig(): RuntimeConfig {
  return current;
}

export function patchConfig(patch: Partial<RuntimeConfig>): RuntimeConfig {
  current = { ...current, ...patch };
  return current;
}

export function resetConfig(): RuntimeConfig {
  current = { ...DEFAULTS };
  return current;
}

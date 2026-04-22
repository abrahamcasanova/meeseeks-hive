import { pino } from 'pino';
import { extractTaskPattern, saveLearnedStrategy, getLearnedStrategies, getLearnedStrategiesSemantic, getAncestryChain, getLastLearner } from './learned-strategy.service.js';
import { emitEvent } from './event.service.js';
import { publish } from './pubsub.service.js';

const log = pino({ name: 'strategy-memory' });

// === INTERFACES ===

export interface StrategyParams {
  retries: number;
  cacheTTL: number;
  backoff: 'linear' | 'exponential' | 'none';
}

export interface Strategy {
  name: string;
  params: StrategyParams;
}

export interface EvalResult {
  score: number;
  requests: number;
  retries: number;
  time_ms: number;
  success: boolean;
  env: string;
  reason?: string;
}

export interface StrategyMemory {
  avg_score: number;
  best_score: number;
  attempts: number;
  contexts: Record<string, { avg: number; count: number }>;
  last_used_iteration: number;
  params: StrategyParams;
}

export interface IterationRecord {
  iteration: number;
  env: string;
  strategy: string;
  requests: number;
  retries: number;
  time_ms: number;
  score: number;
  code?: string;
  reason?: string;
}

// === STORAGE ===

// Per-meeseeks: strategy name -> memory
const strategyMemory = new Map<string, Map<string, StrategyMemory>>();
// Per-meeseeks: iteration history
const iterationHistory = new Map<string, IterationRecord[]>();
// Per-meeseeks: last strategy used
const lastStrategy = new Map<string, { name: string; score: number; params: StrategyParams }>();

// === MEMORY FUNCTIONS (Fase 3) ===

export function getMemory(meeseeksId: string): Map<string, StrategyMemory> {
  if (!strategyMemory.has(meeseeksId)) {
    strategyMemory.set(meeseeksId, new Map());
  }
  return strategyMemory.get(meeseeksId)!;
}

export function getHistory(meeseeksId: string): IterationRecord[] {
  if (!iterationHistory.has(meeseeksId)) {
    iterationHistory.set(meeseeksId, []);
  }
  return iterationHistory.get(meeseeksId)!;
}

export async function updateMemory(
  meeseeksId: string,
  strategy: Strategy,
  result: EvalResult,
  iteration: number,
  code?: string,
  task?: string,
  freeContent?: string,
): Promise<void> {
  const mem = getMemory(meeseeksId);
  const history = getHistory(meeseeksId);
  
  // Update iteration history
  history.push({
    iteration,
    env: result.env,
    strategy: strategy.name,
    requests: result.requests,
    retries: result.retries,
    time_ms: result.time_ms,
    score: result.score,
    code,
    reason: result.reason,
  });

  // Update strategy memory
  const existing = mem.get(strategy.name);
  if (existing) {
    const newAttempts = existing.attempts + 1;
    const newAvg = (existing.avg_score * existing.attempts + result.score) / newAttempts;
    
    // Update context-specific avg
    const ctx = existing.contexts[result.env] || { avg: 0, count: 0 };
    ctx.avg = (ctx.avg * ctx.count + result.score) / (ctx.count + 1);
    ctx.count++;
    existing.contexts[result.env] = ctx;
    
    mem.set(strategy.name, {
      avg_score: newAvg,
      best_score: Math.max(existing.best_score, result.score),
      attempts: newAttempts,
      contexts: existing.contexts,
      last_used_iteration: iteration,
      params: strategy.params,
    });
  } else {
    mem.set(strategy.name, {
      avg_score: result.score,
      best_score: result.score,
      attempts: 1,
      contexts: { [result.env]: { avg: result.score, count: 1 } },
      last_used_iteration: iteration,
      params: strategy.params,
    });
  }

  // Track last used strategy
  lastStrategy.set(meeseeksId, {
    name: strategy.name,
    score: result.score,
    params: strategy.params,
  });

  log.info({
    id: meeseeksId.slice(0, 8),
    strategy: strategy.name,
    score: result.score,
    env: result.env,
    iteration,
  }, 'Memory updated');

  // Persist to DB if score >= 8 and we have content and task.
  // In free mode `code` is undefined — use `freeContent` (the raw LLM response) as the template.
  const contentToSave = code ?? freeContent;
  if (result.score >= 8 && contentToSave && task) {
    const taskPattern = extractTaskPattern(task);
    await saveLearnedStrategy(taskPattern, strategy, contentToSave, result.score, result.env, meeseeksId, task);
    log.info({ taskPattern, strategy: strategy.name, score: result.score }, 'Strategy persisted to DB');
  }
}

// === SELECTOR (Fase 4) ===

export function selectStrategy(
  meeseeksId: string,
  env: string,
  iteration: number,
  isAlgorithmic = false
): { action: 'reuse' | 'adapt' | 'explore'; suggested: Strategy | null; reason: string } {
  const mem = getMemory(meeseeksId);
  const last = lastStrategy.get(meeseeksId);
  
  // First iteration: no suggestion
  if (mem.size === 0) {
    return { action: 'adapt', suggested: null, reason: 'first iteration' };
  }

  // Find best strategy for this env
  let bestForEnv: { name: string; score: number; params: StrategyParams } | null = null;
  let bestGlobal: { name: string; score: number; params: StrategyParams } | null = null;

  for (const [name, data] of mem) {
    // Best for current env
    if (data.contexts[env] && data.contexts[env].avg >= 6) {
      if (!bestForEnv || data.contexts[env].avg > bestForEnv.score) {
        bestForEnv = { name, score: data.contexts[env].avg, params: data.params };
      }
    }
    // Best global
    if (!bestGlobal || data.avg_score > bestGlobal.score) {
      bestGlobal = { name, score: data.avg_score, params: data.params };
    }
  }

  // Rule 1: Good strategy for this env exists -> reuse
  if (bestForEnv && bestForEnv.score >= 7) {
    return {
      action: 'reuse',
      suggested: { name: bestForEnv.name, params: bestForEnv.params },
      reason: `best for ${env} (avg ${bestForEnv.score.toFixed(1)})`,
    };
  }

  // Rule 2: Every 3 iterations -> explore (slight variation)
  // Skip for algorithmic plugins — retries/cacheTTL variants are meaningless for them
  if (!isAlgorithmic && iteration % 3 === 0 && bestGlobal) {
    const variant = createVariant(bestGlobal.name, bestGlobal.params);
    return {
      action: 'explore',
      suggested: variant,
      reason: `explore iteration (variant of ${bestGlobal.name})`,
    };
  }

  // Rule 3: Use best global
  if (bestGlobal) {
    return {
      action: 'adapt',
      suggested: { name: bestGlobal.name, params: bestGlobal.params },
      reason: `best global (avg ${bestGlobal.score.toFixed(1)})`,
    };
  }

  return { action: 'adapt', suggested: null, reason: 'no data' };
}

function createVariant(baseName: string, baseParams: StrategyParams): Strategy {
  // Create slight variation
  const variations = [
    { retries: baseParams.retries + 1, cacheTTL: baseParams.cacheTTL, backoff: baseParams.backoff },
    { retries: Math.max(1, baseParams.retries - 1), cacheTTL: baseParams.cacheTTL, backoff: baseParams.backoff },
    { retries: baseParams.retries, cacheTTL: baseParams.cacheTTL + 1000, backoff: baseParams.backoff },
    { retries: baseParams.retries, cacheTTL: baseParams.cacheTTL, backoff: baseParams.backoff === 'exponential' ? 'linear' : 'exponential' as const },
  ];
  
  const variant = variations[Math.floor(Math.random() * variations.length)];
  const suffix = variant.retries !== baseParams.retries ? `_r${variant.retries}` : 
                 variant.backoff !== baseParams.backoff ? `_${variant.backoff.slice(0,3)}` : '_v2';
  
  return {
    name: baseName.replace(/_v\d+$|_r\d+$|_exp$|_lin$/, '') + suffix,
    params: variant as StrategyParams,
  };
}

// === ANTI-COLLAPSE (Fase 5) ===

export function validateChange(
  meeseeksId: string,
  newStrategy: Strategy
): { valid: boolean; reason: string } {
  const last = lastStrategy.get(meeseeksId);
  
  // No last strategy = always valid
  if (!last) {
    return { valid: true, reason: 'first strategy' };
  }

  // If last score >= 8, restrict changes
  if (last.score >= 8) {
    // Check parameter change percentage
    const paramChanges = [
      last.params.retries !== newStrategy.params.retries,
      last.params.cacheTTL !== newStrategy.params.cacheTTL,
      last.params.backoff !== newStrategy.params.backoff,
    ].filter(Boolean).length;
    
    const changePercent = (paramChanges / 3) * 100;
    
    if (changePercent > 30) {
      return {
        valid: false,
        reason: `score was ${last.score}, change >30% (${changePercent.toFixed(0)}%)`,
      };
    }

    // Check family change (fetchWithRetry vs completely different name)
    const lastFamily = last.name.split(/[_-]/)[0].toLowerCase();
    const newFamily = newStrategy.name.split(/[_-]/)[0].toLowerCase();
    
    if (lastFamily !== newFamily) {
      return {
        valid: false,
        reason: `score was ${last.score}, family change (${lastFamily} -> ${newFamily})`,
      };
    }
  }

  return { valid: true, reason: 'change allowed' };
}

// === PROMPT BUILDING ===

export async function buildMemoryPrompt(meeseeksId: string, env: string, iteration: number, task?: string, isAlgorithmic = false): Promise<string> {
  const mem = getMemory(meeseeksId);
  const history = getHistory(meeseeksId);
  const selection = selectStrategy(meeseeksId, env, iteration, isAlgorithmic);

  // Query learned strategies from DB if we have a task.
  // For known patterns (fetchWithRetry, etc.) use exact match.
  // For 'generic' (everything else) use semantic search — avoids injecting unrelated task noise.
  let learnedStrategies: Awaited<ReturnType<typeof getLearnedStrategies>> = [];
  if (task) {
    const taskPattern = extractTaskPattern(task);
    if (taskPattern !== 'generic') {
      learnedStrategies = await getLearnedStrategies(taskPattern, 3);
    } else {
      learnedStrategies = await getLearnedStrategiesSemantic(task, 3);
    }
  }
  
  if (mem.size === 0) {
    let prompt = `
=== ITERATION ${iteration} | ENV: ${env} ===
`;

    // Add learned strategies from previous agents if available
    if (learnedStrategies.length > 0) {
      prompt += `\n=== LEARNED FROM PREVIOUS AGENTS ===\n`;
      for (const ls of learnedStrategies) {
        prompt += `• ${ls.strategy_name}: avg=${ls.avg_score.toFixed(1)} (${ls.success_count} wins)\n`;
        prompt += `  Params: ${JSON.stringify(ls.strategy_params)}\n`;
        prompt += `  Pattern:\n${ls.code_template}\n\n`;
      }
      prompt += `RECOMMENDATION: Start with one of the proven strategies above.\n`;
      const firstStrategy = learnedStrategies[0];
      // Iter 1: agent has no rows yet — find last learner who isn't me
      const lastLearner = firstStrategy
        ? await getLastLearner(firstStrategy.strategy_name, meeseeksId)
        : null;
      // Build chain from lastLearner upward
      const directSource = lastLearner;
      const ancestry = directSource
        ? await getAncestryChain(directSource, firstStrategy!.strategy_name)
        : [];
      const fullChain = directSource ? [directSource, ...ancestry] : [];
      const memPayload = {
        strategies: learnedStrategies.map(ls => ({
          name: ls.strategy_name,
          avg: ls.avg_score,
          wins: ls.success_count,
          sourceId: directSource !== meeseeksId ? (directSource ?? undefined) : undefined,
        })),
        ancestry: fullChain,
        iteration,
      };
      emitEvent(meeseeksId, 'memory_injected', memPayload).catch(() => {});
      publish({ type: 'meeseeks:memory_injected', data: { id: meeseeksId, ...memPayload } });
    }

    const strategyFmt = isAlgorithmic
      ? `// STRATEGY: {"name":"algorithmName","params":{"algorithm":"describe_approach"}}`
      : `// STRATEGY: {"name":"yourStrategyName","params":{"retries":3,"cacheTTL":0,"backoff":"exponential"}}`;
    const nameExamples = isAlgorithmic
      ? 'minimax, bfs_optimal, backtracking_v2, constraint_prop'
      : 'fetchWithRetry, cachedFetch, exponentialBackoff';
    prompt += `
STRATEGY DECLARATION REQUIRED:
Your code MUST start with this exact format:
${strategyFmt}

Rules for strategy name:
- Use descriptive names: ${nameExamples}
- NO generic names like "attempt_1" or "solution"
- Keep the same name if you're reusing a strategy
`;
    return prompt;
  }

  let prompt = `
=== ITERATION ${iteration} | ENV: ${env} ===

STRATEGY MEMORY:
`;

  // Show top strategies
  const sorted = [...mem.entries()].sort((a, b) => b[1].avg_score - a[1].avg_score);
  for (const [name, data] of sorted.slice(0, 3)) {
    const envData = data.contexts[env];
    prompt += `• ${name}: avg=${data.avg_score.toFixed(1)} best=${data.best_score}`;
    if (envData) prompt += ` [${env}:${envData.avg.toFixed(1)}]`;
    prompt += `\n`;
  }

  if (learnedStrategies.length > 0) {
    prompt += `\nLEARNED FROM PREVIOUS AGENTS:\n`;
    for (const ls of learnedStrategies) {
      prompt += `• ${ls.strategy_name}: avg=${ls.avg_score.toFixed(1)} (${ls.success_count} wins)\n`;
    }
    // No re-emit memory_injected on subsequent iterations — ancestry already sent on iter 1
  }

  // Recent scores
  prompt += `\nRECENT: ${history.slice(-4).map(h => h.score).join(' → ')}\n`;

  // Selection directive
  prompt += `\nDIRECTIVE (${selection.action}): ${selection.reason}\n`;
  
  if (selection.suggested) {
    if (isAlgorithmic) {
      prompt += `SUGGESTED: ${selection.suggested.name} (reuse/improve this algorithm)\n`;
    } else {
      prompt += `SUGGESTED: ${selection.suggested.name} with params ${JSON.stringify(selection.suggested.params)}\n`;
    }
  }

  const strategyDecl = isAlgorithmic
    ? `// STRATEGY: {"name":"algorithmName","params":{"algorithm":"describe_approach"}}`
    : `// STRATEGY: {"name":"strategyName","params":{"retries":N,"cacheTTL":N,"backoff":"linear|exponential|none"}}`;
  prompt += `
STRATEGY DECLARATION REQUIRED:
${strategyDecl}
`;

  return prompt;
}

// === BASELINE (Fase 7) ===

export interface BaselineResult {
  scores: number[];
  avg: number;
  failures: number;
}

const baselineResults = new Map<string, BaselineResult>();

export function setBaseline(meeseeksId: string, results: BaselineResult): void {
  baselineResults.set(meeseeksId, results);
}

export function getBaseline(meeseeksId: string): BaselineResult | null {
  return baselineResults.get(meeseeksId) || null;
}

// === REPORT (Fase 8) ===

export function generateReport(meeseeksId: string): {
  table: IterationRecord[];
  baseline: BaselineResult | null;
  system: { avg: number; failures: number };
  comparison: { improvement: number; meetsTarget: boolean };
  winnerCode: { code: string; strategy: string; score: number; iteration: number } | null;
} {
  const history = getHistory(meeseeksId);
  const baseline = getBaseline(meeseeksId);
  
  const systemAvg = history.length > 0 
    ? history.reduce((sum, h) => sum + h.score, 0) / history.length 
    : 0;
  const systemFailures = history.filter(h => h.score < 4).length;

  // Calculate improvement, avoiding division by zero
  let improvement = 0;
  if (baseline) {
    if (baseline.avg === 0) {
      // Baseline failed completely (score 0)
      improvement = systemAvg > 0 ? 100 : 0; // 100% improvement if system scored anything
    } else {
      improvement = ((systemAvg - baseline.avg) / baseline.avg) * 100;
    }
  }

  // Find best iteration with code
  const best = history
    .filter(h => h.code)
    .sort((a, b) => b.score - a.score || a.iteration - b.iteration)[0];

  return {
    table: history,
    baseline,
    system: { avg: systemAvg, failures: systemFailures },
    comparison: {
      improvement,
      meetsTarget: improvement >= 20 && systemFailures <= 1,
    },
    winnerCode: best ? {
      code: best.code!,
      strategy: best.strategy,
      score: best.score,
      iteration: best.iteration,
    } : null,
  };
}

// === CLEAR ===

export function clearMemory(meeseeksId: string): void {
  strategyMemory.delete(meeseeksId);
  iterationHistory.delete(meeseeksId);
  lastStrategy.delete(meeseeksId);
  baselineResults.delete(meeseeksId);
}

// === LEGACY EXPORTS (for compatibility) ===

export function getAttempts(meeseeksId: string): { name: string; score: number; iteration: number; pattern?: string }[] {
  return getHistory(meeseeksId).map(h => ({
    name: h.strategy,
    score: h.score,
    iteration: h.iteration,
    pattern: h.env,
  }));
}

export function getBestAttempt(meeseeksId: string): { name: string; score: number } | null {
  const history = getHistory(meeseeksId);
  if (history.length === 0) return null;
  const best = history.reduce((b, h) => h.score > b.score ? h : b);
  return { name: best.strategy, score: best.score };
}

export function recordAttempt(meeseeksId: string, attempt: {
  name: string;
  iteration: number;
  success: boolean;
  error: string | null;
  score: number;
  durationMs: number;
  codeRan: boolean;
  pattern?: string;
}): void {
  // This is now handled by updateMemory, but keep for compatibility
  log.info({
    id: meeseeksId.slice(0, 8),
    strategy: attempt.name,
    score: attempt.score,
    iteration: attempt.iteration,
    env: attempt.pattern,
  }, 'Attempt recorded (legacy)');
}

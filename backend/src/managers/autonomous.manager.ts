import * as meeseeksService from '../services/meeseeks.service.js';
import * as messageService from '../services/message.service.js';
import * as costService from '../services/cost.service.js';
import { executeCode, extractCodeBlocks } from '../services/sandbox.service.js';
import { buildHarnessWithPlugin, getPlugin } from '../services/plugin-registry.js';
import { evaluate, evaluateFreeResponse } from '../services/evaluator.service.js';
import { spawnChild } from './spawn.manager.js';
import {
  updateMemory,
  buildMemoryPrompt,
  selectStrategy,
  validateChange,
  generateReport,
  setBaseline,
  getHistory,
  getBestAttempt,
  Strategy,
  EvalResult,
} from '../services/strategy-memory.service.js';
import { calculateStress, getStressLabel, getStressSystemPrompt } from '../services/stress.service.js';
import { getConfig } from '../services/runtime-config.service.js';
import { getDefaultAdapter } from '../adapters/index.js';
import { publish } from '../services/pubsub.service.js';
import { config } from '../config.js';
import { pino } from 'pino';

const log = pino({ name: 'autonomous' });

const THINK_INTERVAL_MS = 8_000; // interval fijo — no cambia en runtime (requiere reinicio)
// MIN_ITERATIONS, MAX_ITERATIONS, spawn threshold → leídos de getConfig() en runtime
const ENV_SEQUENCE = ['easy', 'medium', 'random', 'hard', 'chaos', 'chaos', 'easy', 'medium'];
const working = new Set<string>();
const iterationCount = new Map<string, number>();
const scoreHistory = new Map<string, number[]>();
const hasSpawnedChild = new Set<string>();

export function getScoreHistory(id: string): number[] {
  return scoreHistory.get(id) ?? [];
}

/** Returns true when the agent should stop after this iteration */
function shouldStop(meeseeksId: string, score: number, count: number, pluginUsesEnvs: boolean): boolean {
  const cfg = getConfig();
  const history = scoreHistory.get(meeseeksId) ?? [];
  history.push(score);
  scoreHistory.set(meeseeksId, history);

  // Hard cap
  if (count >= cfg.maxIterations) return true;

  // Perfect score — harnesses without envs can stop on iter 1
  const minIters = pluginUsesEnvs ? cfg.minIterations : 1;
  if (score === 10 && count >= minIters) return true;

  // Free mode (no envs): stop at score >= 9 — iterating further causes the agent to produce
  // theatrical filler instead of improving (it "celebrates" instead of refining the answer)
  if (!pluginUsesEnvs && score >= 9 && count >= minIters) return true;

  // Stuck at low score: last 3 iters all <= threshold and we've done enough iterations
  // Algorithmic plugins (non-env): threshold=2 (actual failure), require 6 iters before giving up
  // Env-based plugins: threshold=4, require 5 iters
  const stuckThreshold = pluginUsesEnvs ? 4 : 2;
  const stuckMinCount = pluginUsesEnvs ? 5 : 6;
  if (count >= stuckMinCount && history.length >= 3) {
    const last3 = history.slice(-3);
    if (Math.max(...last3) <= stuckThreshold) return true;
  }

  // Converged at high score: last 3 iters all >= 8
  if (count >= 4 && history.length >= 3) {
    const last3 = history.slice(-3);
    if (last3.every(s => s >= 8)) return true;
  }

  // Mediocre plateau: last 4 iters all between 5-7 (not improving, not failing)
  // Only for env-based plugins — algorithmic plugins may need more iterations to find optimal approach
  if (pluginUsesEnvs && count >= 5 && history.length >= 4) {
    const last4 = history.slice(-4);
    if (last4.every(s => s >= 5 && s <= 7)) return true;
  }

  return false;
}

let interval: ReturnType<typeof setInterval> | null = null;

export async function start(): Promise<void> {
  // Mark any alive agents from a previous session as dead — they lost their in-memory state
  try {
    const orphans = await meeseeksService.listActive();
    for (const m of orphans) {
      await meeseeksService.kill(m.id, 'Orphaned: backend restarted');
      log.warn({ id: m.id.slice(0, 8) }, 'Killed orphaned meeseeks from previous session');
    }
  } catch (err) {
    log.error(err, 'Failed to clean orphaned meeseeks on startup');
  }
  interval = setInterval(tickAutonomous, THINK_INTERVAL_MS);
  log.info('Autonomous manager started (adaptive stopping: 2-8 iterations)');
}

export function stop(): void {
  if (interval) clearInterval(interval);
  interval = null;
}

export function triggerImmediate(meeseeksId: string): void {
  setTimeout(() => think(meeseeksId).catch(err => log.error(err, 'Delayed think error')), 1000);
}

async function tickAutonomous(): Promise<void> {
  try {
    const alive = await meeseeksService.listActive();
    log.debug({ count: alive.length }, 'Tick - checking alive agents');
    
    for (const m of alive) {
      const count = iterationCount.get(m.id) ?? 0;
      
      // Check 1: Already working
      if (working.has(m.id)) {
        log.debug({ id: m.id.slice(0, 8), iter: count }, 'Skip - agent busy');
        continue;
      }
      
      // Check 2: Token limit reached → kill agent
      // Free mode uses a higher token budget since responses are verbose text
      const pluginForTick = getPlugin(m.harness ?? 'js-api');
      const cfg = getConfig();
      const tokenLimit = pluginForTick?.isFreeMode ? cfg.maxTokensFreeMeeseeks : cfg.maxTokensPerMeeseeks;
      if (m.total_tokens >= tokenLimit) {
        log.warn({ 
          id: m.id.slice(0, 8), 
          tokens: m.total_tokens, 
          limit: tokenLimit,
          freeMode: pluginForTick?.isFreeMode ?? false,
          iter: count 
        }, 'Token limit reached - killing agent');
        await completeWithReport(m.id, 'token limit reached');
        continue;
      }
      
      // Check 3: Max iterations reached
      if (count >= getConfig().maxIterations) {
        log.info({ id: m.id.slice(0, 8), count }, 'Max iterations reached - completing');
        await completeWithReport(m.id, 'max iterations reached');
        continue;
      }
      
      // Check 4: Message state - determine if we should think
      const messages = await messageService.getRecent(m.id, 1);
      if (!messages[0]) {
        log.debug({ id: m.id.slice(0, 8), iter: count }, 'No messages - starting agent');
        think(m.id).catch(err => log.error(err, 'Unhandled think error'));
      } else if (messages[0].role === 'assistant') {
        // Last message was from assistant → waiting for feedback
        // This might indicate stuck state if too old
        const msgAge = Date.now() - new Date(messages[0].created_at).getTime();
        if (msgAge > 30_000) {
          log.warn({ 
            id: m.id.slice(0, 8), 
            iter: count,
            ageMs: msgAge,
            msgId: messages[0].id.slice(0, 8)
          }, 'Stuck state detected - forcing feedback');
          
          // Auto-recovery: inject feedback message to unstuck
          const feedback = `ITER ${count}/${getConfig().maxIterations} | SCORE: 0/10\nrequests=0 retries=0 time=0ms success=false\n⚠ AUTO-RECOVERY: stuck state detected, forcing continuation`;
          const feedbackMsg = await messageService.create(m.id, 'user', feedback);
          publish({ type: 'message:new', data: { meeseeksId: m.id, message: feedbackMsg } });
        } else {
          log.debug({ id: m.id.slice(0, 8), iter: count, ageMs: msgAge }, 'Skip - waiting for feedback');
        }
      } else {
        // Last message was from user → ready to think
        log.debug({ id: m.id.slice(0, 8), iter: count, nextIter: count + 1 }, 'Triggering think');
        think(m.id).catch(err => log.error(err, 'Unhandled think error'));
      }
    }
  } catch (err) {
    log.error(err, 'Autonomous tick error');
  }
}

async function completeWithReport(meeseeksId: string, stopReason?: string): Promise<void> {
  const report = generateReport(meeseeksId);
  const best = getBestAttempt(meeseeksId);

  log.info({
    id: meeseeksId.slice(0, 8),
    systemAvg: report.system.avg.toFixed(1),
    baselineAvg: report.baseline?.avg.toFixed(1) ?? 'N/A',
    improvement: report.comparison.improvement.toFixed(1) + '%',
    meetsTarget: report.comparison.meetsTarget,
  }, 'MVP Complete - Final Report');

  // Si este es un sub-agente (tiene parent_id), reportar al padre con el mejor código
  const self = await meeseeksService.getById(meeseeksId);
  if (self?.parent_id) {
    const parentAlive = await meeseeksService.getById(self.parent_id);
    if (parentAlive && parentAlive.status === 'alive') {
      // Handoff con código
      if (report.winnerCode) {
        const handoff = [
          `🤝 Sub-agente ${meeseeksId.slice(0, 8)} terminó. Score: ${report.winnerCode.score}/10 (avg ${report.system.avg.toFixed(1)}).`,
          `Usa este código como base para tu siguiente iteración:`,
          `\`\`\`javascript`,
          report.winnerCode.code,
          `\`\`\``,
        ].join('\n');
        const msg = await messageService.create(self.parent_id, 'user', handoff);
        publish({ type: 'message:new', data: { meeseeksId: self.parent_id, message: msg } });
        log.info({ childId: meeseeksId.slice(0, 8), parentId: self.parent_id.slice(0, 8), score: report.winnerCode.score }, 'Handoff sent to parent');
      }
      // El sub-agente completó N iteraciones → estrés extra al padre (+0.08 por iteración)
      const childIters = report.table.length;
      const cfg2 = getConfig();
      const stressBoost = Math.min(childIters * cfg2.stressBoostPerChildIter, cfg2.maxStressBoostFromChild);
      const newStress = Math.min((parentAlive.stress ?? 0) + stressBoost, 1.0);
      await meeseeksService.updateStress(self.parent_id, newStress);
      publish({ type: 'meeseeks:stress', data: { id: self.parent_id, stress: newStress, label: 'stressed' } });
      log.info({ parentId: self.parent_id.slice(0, 8), stressBoost, newStress }, 'Stress boost from child completion');
    }
  }

  const stopLabel = stopReason ? ` — stopped: ${stopReason}` : '';
  const reason = `MVP Complete! Avg: ${report.system.avg.toFixed(1)}/10, Best: "${best?.name}" (${best?.score}/10)${stopLabel}`;
  await meeseeksService.kill(meeseeksId, reason);
  publish({ type: 'meeseeks:dying', data: { id: meeseeksId, reason } });

  setTimeout(async () => {
    const dead = await meeseeksService.markDead(meeseeksId);
    if (dead) publish({ type: 'meeseeks:dead', data: { id: meeseeksId, reason } });
  }, 2000);
}

async function think(meeseeksId: string): Promise<void> {
  if (working.has(meeseeksId)) return;
  working.add(meeseeksId);

  let count = 0; // Declare outside try for logging in catch/finally

  try {
    const m = await meeseeksService.getById(meeseeksId);
    if (!m || m.status !== 'alive') return;
    const harnessPluginForGuard = getPlugin(m.harness ?? 'js-api');
    const tokenLimitGuard = harnessPluginForGuard?.isFreeMode ? getConfig().maxTokensFreeMeeseeks : getConfig().maxTokensPerMeeseeks;
    if (m.total_tokens >= tokenLimitGuard) return;

    count = (iterationCount.get(m.id) ?? 0) + 1;
    iterationCount.set(m.id, count);

    // Run baseline once before first iteration (Fase 7)
    if (count === 1) {
      await runBaseline(m.id, m.harness ?? 'js-api');
    }

    // Fixed env sequence — only meaningful for harnesses that use environment failure patterns
    const harnessPlugin = getPlugin(m.harness ?? 'js-api');
    const env = harnessPlugin?.usesEnvironments ? (ENV_SEQUENCE[count - 1] || 'chaos') : 'standard';

    const scores = getScoreHistory(m.id);
    const stress = calculateStress(m, scores);
    const recentMessages = await messageService.getRecent(m.id, 10);

    // Strategy selection (Fase 4)
    const selection = selectStrategy(m.id, env, count, harnessPlugin?.isAlgorithmic ?? false);
    log.info({ id: m.id.slice(0, 8), iteration: count, env, action: selection.action, reason: selection.reason }, 'Strategy selected');

    // Build prompt with strategy memory
    const memoryPrompt = await buildMemoryPrompt(m.id, env, count, m.task, harnessPlugin?.isAlgorithmic ?? false);
    const systemPrompt = buildPrompt(m.task, m.id, stress, count, env, memoryPrompt, m.harness ?? 'js-api');

    const nonSystemMessages = recentMessages.filter(msg => msg.role !== 'system');
    if (!nonSystemMessages.some(msg => msg.role === 'user')) {
      const initMsg = await messageService.create(m.id, 'user', `Your task: ${m.task}\n\nBegin working. Show code.`);
      publish({ type: 'message:new', data: { meeseeksId: m.id, message: initMsg } });
      nonSystemMessages.push(initMsg);
    }

    const chatMessages = nonSystemMessages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // LLM call — timeout 90s para evitar hung indefinido
    const adapter = getDefaultAdapter();
    const LLM_TIMEOUT_MS = 90_000;
    const response = await Promise.race([
      adapter.chat({ messages: chatMessages, model: m.model, systemPrompt, maxTokens: 2048 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM call timed out after 90s')), LLM_TIMEOUT_MS)
      ),
    ]);
    const cost = costService.calculateCost(adapter.model, response.inputTokens, response.outputTokens);

    // Safety: truncate massive responses (likely data dumps, not code)
    let content = response.content;
    if (response.outputTokens > 3000) {
      log.warn({ 
        id: m.id.slice(0, 8), 
        iter: count,
        outputTokens: response.outputTokens,
        totalTokens: m.total_tokens + response.inputTokens + response.outputTokens
      }, 'Truncating massive LLM response - likely data dump');
      content = content.slice(0, 8000) + '\n\n[TRUNCATED - response too large]';
    }

    const assistantMsg = await messageService.create(m.id, 'assistant', content, response.inputTokens + response.outputTokens, cost, adapter.model);
    await costService.record({ meeseeks_id: m.id, model: adapter.model, input_tokens: response.inputTokens, output_tokens: response.outputTokens, cost });
    publish({ type: 'message:new', data: { meeseeksId: m.id, message: assistantMsg } });
    publish({ type: 'cost:update', data: await costService.getGlobalCost() });

    // Extract strategy from code (Fase 2)
    const strategy = extractStrategy(content, count);

    // Anti-collapse validation (Fase 5)
    const validation = validateChange(m.id, strategy);
    if (!validation.valid) {
      log.warn({ id: m.id.slice(0, 8), reason: validation.reason }, 'Strategy change blocked');
    }

    // EXECUTE CODE — run in sandbox with the assigned harness plugin
    const codeBlocks = extractCodeBlocks(content);
    let execResult: { success: boolean; output: string; error: string; exitCode: number | null; durationMs: number } = { success: false, output: '', error: 'No code blocks found', exitCode: 1, durationMs: 0 };
    let evalResult: EvalResult = { score: 0, requests: 0, retries: 0, time_ms: 0, success: false, env };

    if (harnessPlugin?.isFreeMode) {
      // Free mode: evaluate the current response content directly (not history comparison)
      // This avoids the 600-char truncation bug in evaluate()
      const llmEval = await evaluateFreeResponse(m.task, content);
      evalResult = {
        score: llmEval.quality_score,
        requests: 0,
        retries: 0,
        time_ms: 0,
        success: llmEval.quality_score >= 6,
        env,
        reason: llmEval.reason,
      };
      log.info({ id: m.id.slice(0, 8), iter: count, quality: llmEval.quality_score, reason: llmEval.reason }, 'Free mode LLM eval complete');
    } else if (codeBlocks.length > 0) {
      const pluginId = m.harness ?? 'js-api';
      const testCode = buildHarnessWithPlugin(pluginId, codeBlocks[0]!, m.task, count);
      execResult = await executeCode(testCode);

      // Parse structured result
      try {
        const jsonLines = execResult.output.split('\n').filter(l => l.startsWith('{'));
        if (jsonLines.length > 0) {
          const parsed = JSON.parse(jsonLines[jsonLines.length - 1]!);
          evalResult = {
            score: parsed.score ?? 0,
            requests: parsed.requests ?? 0,
            retries: parsed.retries ?? 0,
            time_ms: parsed.time_ms ?? execResult.durationMs,
            success: parsed.success ?? false,
            env: parsed.env ?? env,
            reason: parsed.reason ?? undefined,
          };
        }
      } catch {
        evalResult.score = execResult.success ? 4 : 2;
      }
    } else {
      evalResult.score = 2;
    }

    // Feedback message — always send so LLM gets signal even on failures
    const envLabel = harnessPlugin?.usesEnvironments ? ` | ENV: ${env}` : '';
    const noCodeWarning = (!harnessPlugin?.isFreeMode && codeBlocks.length === 0)
      ? '\n⚠ NO CODE BLOCK FOUND — wrap code in ```javascript ... ```'
      : '';
    const freeModeLabel = harnessPlugin?.isFreeMode ? ' | MODE: free (LLM eval)' : '';
    const judgeLine = evalResult.reason ? `\nJUDGE: ${evalResult.reason}` : '';
    const feedback = `ITER ${count}/${getConfig().maxIterations}${envLabel}${freeModeLabel} | SCORE: ${evalResult.score}/10
requests=${evalResult.requests} retries=${evalResult.retries} time=${evalResult.time_ms}ms success=${evalResult.success}${judgeLine}${noCodeWarning}`;

    const feedbackMsg = await messageService.create(m.id, 'user', feedback);
    publish({ type: 'message:new', data: { meeseeksId: m.id, message: feedbackMsg } });

    // Update memory (Fase 3)
    // Pass `content` as freeContent so free-mode responses get persisted when score >= 8
    const freeContent = harnessPlugin?.isFreeMode ? content : undefined;
    await updateMemory(m.id, strategy, evalResult, count, codeBlocks[0], m.task, freeContent);

    log.info({
      id: m.id.slice(0, 8),
      iteration: count,
      env,
      strategy: strategy.name,
      score: evalResult.score,
      requests: evalResult.requests,
      retries: evalResult.retries,
      time_ms: evalResult.time_ms,
    }, 'Iteration complete');

    // Check if done (adaptive stopping)
    if (shouldStop(m.id, evalResult.score, count, harnessPlugin?.usesEnvironments ?? true)) {
      const stopReason = evalResult.score === 10 ? 'perfect score'
        : evalResult.score >= 9 && !(harnessPlugin?.usesEnvironments) ? 'excellent score'
        : count >= getConfig().maxIterations ? 'max iterations reached'
        : 'convergence detected';
      log.info({ id: m.id.slice(0, 8), iteration: count, score: evalResult.score, stopReason }, 'Stopping agent');
      await completeWithReport(m.id, stopReason);
    } else if (stress >= getConfig().spawnStressThreshold && m.spawn_depth < 2 && !hasSpawnedChild.has(m.id)) {
      // Estrés moderado → pedir sub-agente de apoyo
      const child = await spawnChild(m.id, m.task);
      if (child) {
        hasSpawnedChild.add(m.id);
        triggerImmediate(child.id);
        const helpMsg = await messageService.create(
          m.id, 'user',
          `🆘 Estrés crítico (${Math.round(stress * 100)}%). Sub-agente ${child.id.slice(0, 8)} asignado para ayudar.`
        );
        publish({ type: 'message:new', data: { meeseeksId: m.id, message: helpMsg } });
        log.info({ id: m.id.slice(0, 8), childId: child.id.slice(0, 8), stress }, 'Sub-agent spawned due to stress');
      }
    }

  } catch (err) {
    log.error({ 
      err, 
      id: meeseeksId.slice(0, 8), 
      iter: count,
      errMsg: err instanceof Error ? err.message : String(err)
    }, 'Think error - unlocking agent');
    await meeseeksService.incrementFailedAttempts(meeseeksId).catch(() => {});
  } finally {
    working.delete(meeseeksId);
    log.debug({ id: meeseeksId.slice(0, 8), iter: count }, 'Think complete - agent unlocked');
  }
}

function buildPrompt(task: string, id: string, stress: number, iteration: number, env: string, memoryPrompt: string, harness: string): string {
  const hPlugin = getPlugin(harness);
  const taskInstructions = hPlugin?.promptInstructions ?? '';
  const envLabel = hPlugin?.usesEnvironments ? ` | ENV: ${env}` : '';

  // Free mode: different prompt — no code format constraints, but enforce brevity
  if (hPlugin?.isFreeMode) {
    return `You are Mr. Meeseeks #${id.slice(0, 8)}. Complete the task or die trying.

OBJECTIVE: ${task}

ITERATION: ${iteration}/${getConfig().maxIterations} | Stress: ${Math.round(stress * 100)}%
${memoryPrompt}
⚠️ MAX 40 LINES. Direct answer. No padding.

TASK INTERFACE:
${taskInstructions}`;
  }

  const strategyRule = hPlugin?.isAlgorithmic
    ? `// STRATEGY: {"name":"algorithmName","params":{"algorithm":"describe_your_approach"}}`
    : `// STRATEGY: {"name":"yourName","params":{"retries":N,"cacheTTL":N,"backoff":"linear|exponential|none"}}`;
  return `You are Mr. Meeseeks #${id.slice(0, 8)}. Complete the task or die trying.

OBJECTIVE: ${task}

ITERATION: ${iteration}/${getConfig().maxIterations}${envLabel} | Stress: ${Math.round(stress * 100)}%
${memoryPrompt}
CRITICAL RULES:
1. Your code MUST start with: ${strategyRule}
2. Write ONE \`\`\`javascript block. Close with \`\`\`. NO text after.
3. MAX 40 lines. Self-contained. Only Node.js built-ins.
4. NO dictionaries, NO word lists, NO data dumps. Use LOGIC only.

TASK INTERFACE:
${taskInstructions}`;
}

function extractStrategy(content: string, iteration: number): Strategy {
  // Try to extract STRATEGY JSON comment
  const strategyMatch = content.match(/\/\/\s*STRATEGY:\s*(\{[^}]+\})/);
  if (strategyMatch) {
    try {
      const parsed = JSON.parse(strategyMatch[1]);
      if (parsed.name && parsed.params) {
        return {
          name: parsed.name,
          params: {
            retries: parsed.params.retries ?? 3,
            cacheTTL: parsed.params.cacheTTL ?? 0,
            backoff: parsed.params.backoff ?? 'exponential',
          },
        };
      }
    } catch {}
  }

  // Fallback: extract function name
  const funcMatch = content.match(/(?:function|const|let|var)\s+(\w+)/);
  const name = funcMatch?.[1] ?? `strategy_${iteration}`;

  return {
    name,
    params: { retries: 3, cacheTTL: 0, backoff: 'exponential' },
  };
}

// === BASELINE (Fase 7) ===

export async function runBaseline(meeseeksId: string, harness: string = 'js-api'): Promise<void> {
  const scores: number[] = [];
  const bPlugin = getPlugin(harness);
  const baselineCode = bPlugin?.baselineCode ?? '';

  if (!baselineCode) {
    log.warn({ id: meeseeksId.slice(0, 8), harness }, 'No baseline code for harness, skipping');
    setBaseline(meeseeksId, { scores: [0], avg: 0, failures: 1 });
    return;
  }

  const iterations = bPlugin?.usesEnvironments ? 5 : 1;

  // Free mode has no runnable baseline — score 0 is expected
  if (bPlugin?.isFreeMode) {
    setBaseline(meeseeksId, { scores: [0], avg: 0, failures: 0 });
    log.info({ id: meeseeksId.slice(0, 8), harness }, 'Free mode — baseline skipped');
    return;
  }

  for (let i = 1; i <= iterations; i++) {
    const testCode = buildHarnessWithPlugin(harness, baselineCode, 'baseline', i);
    const result = await executeCode(testCode);

    let score = 0;
    try {
      const jsonLines = result.output.split('\n').filter(l => l.startsWith('{'));
      if (jsonLines.length > 0) {
        const parsed = JSON.parse(jsonLines[jsonLines.length - 1]!);
        score = parsed.score ?? 0;
      }
    } catch {}

    scores.push(score);
  }

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const failures = scores.filter(s => s < 4).length;

  setBaseline(meeseeksId, { scores, avg, failures });
  log.info({ id: meeseeksId.slice(0, 8), harness, scores, avg: avg.toFixed(1), failures }, 'Baseline complete');
}

// === REPORT ENDPOINT HELPER ===

export function getReport(meeseeksId: string) {
  return generateReport(meeseeksId);
}

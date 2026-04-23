import type { LLMAdapter } from '../adapters/llm.types.js';
import { executeCode, extractCodeBlocks } from '../services/sandbox.service.js';
import { buildHarnessWithPlugin, getPlugin } from '../services/plugin-registry.js';
import { evaluateFreeResponse } from '../services/evaluator.service.js';
import type { EvaluatorMessage } from '../services/evaluator.service.js';
import type { StrategyMemoryService } from '../services/strategy-memory.service.js';
import { buildMemoryPrompt } from '../services/strategy-memory.service.js';

export interface EvalResult {
  score: number;
  requests: number;
  retries: number;
  time_ms: number;
  success: boolean;
  env: string;
  reason?: string;
}

export interface IterationInfo {
  iteration: number;
  score: number;
  code: string | undefined;
  evalResult: EvalResult;
}

export interface QualityGateOptions {
  /** The task description sent to the LLM */
  task: string;
  /** An already-constructed LLMAdapter instance */
  adapter: LLMAdapter;
  /** Optional separate adapter for judging free-mode responses (avoids judge == generator bias) */
  judgeAdapter?: LLMAdapter;
  /** Harness plugin id — e.g. 'js-api', 'js-lrucache', 'free'. Defaults to 'js-api' */
  harness?: string;
  /** Stop when score >= this value. Defaults to 8 */
  minScore?: number;
  /** Maximum LLM iterations before returning best result. Overrides mode if set explicitly */
  maxRetries?: number;
  /** Iteration mode: fast=1, balanced=3 (default), quality=5 */
  mode?: 'fast' | 'balanced' | 'quality';
  /** Project context injected into the judge prompt for more accurate evaluation */
  projectContext?: string;
  /** Optional strategy memory service for knowledge inheritance across sessions */
  memory?: StrategyMemoryService;
  /** Called after each iteration with progress info */
  onIteration?: (info: IterationInfo) => void;
}

export interface QualityGateResult {
  /** Best code produced (undefined for free-mode tasks) */
  code: string | undefined;
  /** Final score 0-10 */
  score: number;
  /** Whether score >= minScore was reached */
  passed: boolean;
  /** Total iterations performed */
  iterations: number;
  /** Full history of every iteration */
  history: IterationInfo[];
}

export async function qualityGate(opts: QualityGateOptions): Promise<QualityGateResult> {
  const {
    task,
    adapter,
    judgeAdapter,
    harness = 'js-api',
    minScore = 8,
    projectContext,
    memory,
    onIteration,
  } = opts;

  const maxRetries = opts.maxRetries ?? modeToMaxRetries(opts.mode ?? 'balanced');

  const plugin = getPlugin(harness);
  const history: IterationInfo[] = [];
  const conversation: EvaluatorMessage[] = [];
  let bestCode: string | undefined;
  let bestScore = 0;
  let bestStrategyName: string | undefined;

  // Look up proven strategies from memory before starting
  let memoryPrompt = '';
  if (memory) {
    try {
      const strategies = await memory.search(task);
      memoryPrompt = buildMemoryPrompt(strategies);
    } catch {
      // memory failure is non-fatal
    }
  }

  conversation.push({ role: 'user', content: `Your task: ${task}\n\nBegin. Show code.` });

  for (let iteration = 1; iteration <= maxRetries; iteration++) {
    const systemPrompt = buildSystemPrompt(task, iteration, maxRetries, plugin, memoryPrompt);

    const chatMessages = conversation.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await adapter.chat({
      messages: chatMessages,
      model: adapter.model,
      systemPrompt,
      maxTokens: 2048,
    });

    const content = response.content;
    conversation.push({ role: 'assistant', content });

    let evalResult: EvalResult;
    let code: string | undefined;

    if (plugin?.isFreeMode) {
      const llmEval = await evaluateFreeResponse(task, content, adapter, { projectContext, judgeAdapter });
      evalResult = {
        score: llmEval.quality_score,
        requests: 0,
        retries: 0,
        time_ms: 0,
        success: llmEval.quality_score >= 6,
        env: 'free',
        reason: llmEval.reason,
      };
    } else {
      const codeBlocks = extractCodeBlocks(content);
      code = codeBlocks[0];

      if (code) {
        const testCode = buildHarnessWithPlugin(harness, code, task, iteration);
        const execResult = await executeCode(testCode);

        try {
          const jsonLines = execResult.output.split('\n').filter((l: string) => l.startsWith('{'));
          const parsed = jsonLines.length > 0 ? JSON.parse(jsonLines[jsonLines.length - 1]!) : {};
          evalResult = {
            score: parsed.score ?? 0,
            requests: parsed.requests ?? 0,
            retries: parsed.retries ?? 0,
            time_ms: parsed.time_ms ?? execResult.durationMs,
            success: parsed.success ?? false,
            env: parsed.env ?? 'unknown',
            reason: parsed.reason,
          };
        } catch {
          evalResult = {
            score: execResult.success ? 4 : 2,
            requests: 0,
            retries: 0,
            time_ms: execResult.durationMs,
            success: execResult.success,
            env: 'unknown',
          };
        }
      } else {
        evalResult = { score: 0, requests: 0, retries: 0, time_ms: 0, success: false, env: 'unknown' };
      }
    }

    if (evalResult.score > bestScore) {
      bestScore = evalResult.score;
      bestCode = code;
      // Extract strategy name from code comment if present
      const stratMatch = code?.match(/STRATEGY.*?"name"\s*:\s*"([^"]+)"/);
      bestStrategyName = stratMatch?.[1];
    }

    const info: IterationInfo = { iteration, score: evalResult.score, code, evalResult };
    history.push(info);
    onIteration?.(info);

    // Feed score back to LLM so it can improve
    const envLabel = plugin?.usesEnvironments ? ` | ENV: ${evalResult.env}` : '';
    const noCodeWarning = (!plugin?.isFreeMode && !code)
      ? '\n⚠ NO CODE BLOCK FOUND — wrap code in ```javascript ... ```'
      : '';
    const judgeLine = evalResult.reason ? `\nJUDGE: ${evalResult.reason}` : '';
    const feedback = `ITER ${iteration}/${maxRetries}${envLabel} | SCORE: ${evalResult.score}/10\nrequests=${evalResult.requests} retries=${evalResult.retries} time=${evalResult.time_ms}ms success=${evalResult.success}${judgeLine}${noCodeWarning}`;
    conversation.push({ role: 'user', content: feedback });

    if (evalResult.score >= minScore || evalResult.score === 10) break;
  }

  // Save winning strategy to memory
  if (memory && bestScore >= minScore && bestCode) {
    const lastEnv = history[history.length - 1]?.evalResult.env;
    memory.save({
      task,
      strategyName: bestStrategyName ?? 'unnamed',
      code: bestCode,
      score: bestScore,
      env: lastEnv,
      minScore,
    }).catch(() => {}); // non-blocking, non-fatal
  }

  return {
    code: bestCode,
    score: bestScore,
    passed: bestScore >= minScore,
    iterations: history.length,
    history,
  };
}

function modeToMaxRetries(mode: 'fast' | 'balanced' | 'quality'): number {
  if (mode === 'fast') return 1;
  if (mode === 'quality') return 5;
  return 3; // balanced
}

function buildSystemPrompt(
  task: string,
  iteration: number,
  maxRetries: number,
  plugin: ReturnType<typeof getPlugin>,
  memoryPrompt: string,
): string {
  const instructions = plugin?.promptInstructions ?? '';
  const memSection = memoryPrompt ? `\n${memoryPrompt}\n` : '';

  if (plugin?.isFreeMode) {
    return `Complete the task or die trying.
${memSection}
OBJECTIVE: ${task}

ITERATION: ${iteration}/${maxRetries}

TASK INTERFACE:
${instructions}`;
  }

  const strategyRule = plugin?.isAlgorithmic
    ? `// STRATEGY: {"name":"algorithmName","params":{"algorithm":"describe_your_approach"}}`
    : `// STRATEGY: {"name":"yourName","params":{"retries":N,"cacheTTL":N,"backoff":"linear|exponential|none"}}`;

  return `Complete the task or die trying.
${memSection}
OBJECTIVE: ${task}

ITERATION: ${iteration}/${maxRetries}

CRITICAL RULES:
1. Your code MUST start with: ${strategyRule}
2. Write ONE \`\`\`javascript block. Close with \`\`\`. NO text after.
3. MAX 40 lines. Self-contained. Only Node.js built-ins.
4. NO dictionaries, NO word lists, NO data dumps. Use LOGIC only.

TASK INTERFACE:
${instructions}`;
}

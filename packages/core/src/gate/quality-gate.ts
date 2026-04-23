import type { LLMAdapter } from '../adapters/llm.types.js';
import { executeCode, extractCodeBlocks } from '../services/sandbox.service.js';
import { buildHarnessWithPlugin, getPlugin } from '../services/plugin-registry.js';
import { evaluateFreeResponse } from '../services/evaluator.service.js';
import type { EvaluatorMessage } from '../services/evaluator.service.js';

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
  /** Harness plugin id — e.g. 'js-api', 'js-lrucache', 'js-free'. Defaults to 'js-api' */
  harness?: string;
  /** Stop when score >= this value. Defaults to 8 */
  minScore?: number;
  /** Maximum LLM iterations before returning best result. Defaults to 5 */
  maxRetries?: number;
  /** Called after each iteration with progress info */
  onIteration?: (info: IterationInfo) => void;
}

export interface QualityGateResult {
  /** Best code produced (undefined for free-mode tasks) */
  code: string | undefined;
  /** Final score 0-10 */
  score: number;
  /** Total iterations performed */
  iterations: number;
  /** Full history of every iteration */
  history: IterationInfo[];
}

export async function qualityGate(opts: QualityGateOptions): Promise<QualityGateResult> {
  const {
    task,
    adapter,
    harness = 'js-api',
    minScore = 8,
    maxRetries = 5,
    onIteration,
  } = opts;

  const plugin = getPlugin(harness);
  const history: IterationInfo[] = [];
  const conversation: EvaluatorMessage[] = [];
  let bestCode: string | undefined;
  let bestScore = 0;

  conversation.push({ role: 'user', content: `Your task: ${task}\n\nBegin. Show code.` });

  for (let iteration = 1; iteration <= maxRetries; iteration++) {
    const systemPrompt = buildSystemPrompt(task, iteration, maxRetries, plugin);

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
      const llmEval = await evaluateFreeResponse(task, content, adapter);
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
          const jsonLines = execResult.output.split('\n').filter(l => l.startsWith('{'));
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

  return { code: bestCode, score: bestScore, iterations: history.length, history };
}

function buildSystemPrompt(
  task: string,
  iteration: number,
  maxRetries: number,
  plugin: ReturnType<typeof getPlugin>,
): string {
  const instructions = plugin?.promptInstructions ?? '';

  if (plugin?.isFreeMode) {
    return `Complete the task or die trying.

OBJECTIVE: ${task}

ITERATION: ${iteration}/${maxRetries}
⚠️ MAX 40 LINES. Direct answer. No padding.

TASK INTERFACE:
${instructions}`;
  }

  const strategyRule = plugin?.isAlgorithmic
    ? `// STRATEGY: {"name":"algorithmName","params":{"algorithm":"describe_your_approach"}}`
    : `// STRATEGY: {"name":"yourName","params":{"retries":N,"cacheTTL":N,"backoff":"linear|exponential|none"}}`;

  return `Complete the task or die trying.

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

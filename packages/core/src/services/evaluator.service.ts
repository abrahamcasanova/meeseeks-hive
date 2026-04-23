import { pino } from 'pino';
import type { LLMAdapter } from '../adapters/llm.types.js';

const log = pino({ name: 'evaluator' });

export interface Evaluation {
  is_progressing: boolean;
  is_repeating: boolean;
  has_clear_strategy: boolean;
  quality_score: number;
  cost_efficiency_score: number;
  should_continue: boolean;
  should_try_new_strategy: boolean;
  reason: string;
}

export interface EvaluatorMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const DEFAULT_EVAL: Evaluation = {
  is_progressing: true,
  is_repeating: false,
  has_clear_strategy: true,
  quality_score: 5,
  cost_efficiency_score: 5,
  should_continue: true,
  should_try_new_strategy: false,
  reason: 'Evaluation unavailable',
};

export async function evaluate(
  messages: EvaluatorMessage[],
  task: string,
  adapter: LLMAdapter,
): Promise<Evaluation> {
  try {
    const assistantMsgs = messages.filter(m => m.role === 'assistant');

    if (assistantMsgs.length < 2) return { ...DEFAULT_EVAL, reason: 'Too few responses to evaluate' };

    const last5 = assistantMsgs.slice(-5).map((m, i) =>
      `--- Attempt ${i + 1} ---\n${m.content.slice(0, 600)}`
    ).join('\n\n');

    const result = await adapter.chat({
      messages: [{
        role: 'user',
        content: `Evaluate this AI agent's performance on its assigned task.

Task: "${task}"

Last ${assistantMsgs.length >= 5 ? 5 : assistantMsgs.length} attempts:
${last5}

Respond ONLY with valid JSON, no markdown, no explanation outside the JSON:
{
  "is_progressing": boolean,
  "is_repeating": boolean,
  "has_clear_strategy": boolean,
  "quality_score": 0-10,
  "cost_efficiency_score": 0-10,
  "should_continue": boolean,
  "should_try_new_strategy": boolean,
  "reason": "one sentence"
}`,
      }],
      model: adapter.model,
      maxTokens: 200,
      temperature: 0,
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.warn('Evaluator returned non-JSON');
      return DEFAULT_EVAL;
    }

    const parsed = JSON.parse(jsonMatch[0]) as Evaluation;
    log.info({
      quality: parsed.quality_score,
      progressing: parsed.is_progressing,
      repeating: parsed.is_repeating,
      continue: parsed.should_continue,
    }, 'Evaluation complete');

    return parsed;
  } catch (err) {
    log.error(err, 'Evaluation failed');
    return DEFAULT_EVAL;
  }
}

export async function quickCheck(
  messages: EvaluatorMessage[],
  task: string,
  adapter: LLMAdapter,
): Promise<'REAL_PROGRESS' | 'FAKE_PROGRESS' | 'STUCK_LOOP'> {
  try {
    const assistantMsgs = messages.filter(m => m.role === 'assistant');

    if (assistantMsgs.length < 2) return 'REAL_PROGRESS';

    const last3 = assistantMsgs.slice(-3).map(m => m.content.slice(0, 400)).join('\n---\n');

    const result = await adapter.chat({
      messages: [{
        role: 'user',
        content: `Is this agent really solving the task or just generating text that looks like progress?

Task: "${task}"
Last 3 responses:
${last3}

Reply with ONLY one of: REAL_PROGRESS, FAKE_PROGRESS, STUCK_LOOP`,
      }],
      model: adapter.model,
      maxTokens: 20,
      temperature: 0,
    });

    const answer = result.content.trim().toUpperCase();
    if (answer.includes('FAKE')) return 'FAKE_PROGRESS';
    if (answer.includes('STUCK') || answer.includes('LOOP')) return 'STUCK_LOOP';
    return 'REAL_PROGRESS';
  } catch {
    return 'REAL_PROGRESS';
  }
}

export async function evaluateFreeResponse(
  task: string,
  content: string,
  adapter: LLMAdapter,
  opts?: { projectContext?: string; judgeAdapter?: LLMAdapter },
): Promise<Evaluation> {
  try {
    const preview = content.slice(0, 4000);
    const judgeAdapter = opts?.judgeAdapter ?? adapter;
    const contextLine = opts?.projectContext
      ? `\nPROJECT CONTEXT: ${opts.projectContext}\nEvaluate considering this specific stack and conventions.\n`
      : '';

    const result = await judgeAdapter.chat({
      messages: [{
        role: 'user',
        content: `You are a strict, independent code reviewer. Be critical. Score 10 ONLY if zero improvements are possible.
${contextLine}
TASK: "${task}"

RESPONSE:
${preview}

Score quality_score from 0-10:
  10 = correct, complete, fits project context, actionable — zero improvements possible
   8 = very good, minor gaps
   6 = useful but improvable or missing context
   4 = partial or too vague
   2 = wrong, off-topic, or empty

Respond ONLY with valid JSON:
{
  "is_progressing": true,
  "is_repeating": false,
  "has_clear_strategy": true,
  "quality_score": 0-10,
  "cost_efficiency_score": 7,
  "should_continue": boolean,
  "should_try_new_strategy": boolean,
  "reason": "one sentence explaining the score"
}`,
      }],
      model: judgeAdapter.model,
      maxTokens: 200,
      temperature: 0,
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ...DEFAULT_EVAL, reason: 'Non-JSON response from judge' };

    const parsed = JSON.parse(jsonMatch[0]) as Evaluation;
    log.info({ quality: parsed.quality_score, reason: parsed.reason }, 'Free-mode eval complete');
    return parsed;
  } catch (err) {
    log.error(err, 'Free-mode evaluation failed');
    return DEFAULT_EVAL;
  }
}

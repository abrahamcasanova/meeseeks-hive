import { getDefaultAdapter } from '../adapters/index.js';
import * as messageService from './message.service.js';
import { pino } from 'pino';

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

export async function evaluate(meeseeksId: string, task: string): Promise<Evaluation> {
  try {
    const messages = await messageService.getAll(meeseeksId);
    const assistantMsgs = messages.filter(m => m.role === 'assistant');

    if (assistantMsgs.length < 2) return { ...DEFAULT_EVAL, reason: 'Too few responses to evaluate' };

    const last5 = assistantMsgs.slice(-5).map((m, i) =>
      `--- Attempt ${i + 1} ---\n${m.content.slice(0, 600)}`
    ).join('\n\n');

    const adapter = getDefaultAdapter();
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
      log.warn({ id: meeseeksId.slice(0, 8) }, 'Evaluator returned non-JSON');
      return DEFAULT_EVAL;
    }

    const parsed = JSON.parse(jsonMatch[0]) as Evaluation;
    log.info({
      id: meeseeksId.slice(0, 8),
      quality: parsed.quality_score,
      progressing: parsed.is_progressing,
      repeating: parsed.is_repeating,
      continue: parsed.should_continue,
    }, 'Evaluation complete');

    return parsed;
  } catch (err) {
    log.error(err, `Evaluation failed for ${meeseeksId.slice(0, 8)}`);
    return DEFAULT_EVAL;
  }
}

export async function quickCheck(meeseeksId: string, task: string): Promise<'REAL_PROGRESS' | 'FAKE_PROGRESS' | 'STUCK_LOOP'> {
  try {
    const messages = await messageService.getAll(meeseeksId);
    const assistantMsgs = messages.filter(m => m.role === 'assistant');

    if (assistantMsgs.length < 2) return 'REAL_PROGRESS';

    const last3 = assistantMsgs.slice(-3).map(m => m.content.slice(0, 400)).join('\n---\n');

    const adapter = getDefaultAdapter();
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

/**
 * Evaluate the quality of a single free-mode response directly from its content.
 * Used instead of `evaluate()` when the harness is isFreeMode — avoids the
 * 600-char truncation and "progression comparison" framing that kills scoring.
 */
export async function evaluateFreeResponse(task: string, content: string): Promise<Evaluation> {
  try {
    // Send up to 4000 chars — enough for a full structured response
    const preview = content.slice(0, 4000);

    const adapter = getDefaultAdapter();
    const result = await adapter.chat({
      messages: [{
        role: 'user',
        content: `You are a strict quality judge. Rate the following response to a task.

TASK: "${task}"

RESPONSE:
${preview}

Score quality_score from 0-10. Penalize heavily for responses over 40 lines (verbose, padded, repetitive).
  10 = concise, complete, correct, actionable, ≤40 lines
   8 = very good, minor gaps or slightly verbose
   6 = useful but too long or incomplete
   4 = partial, superficial, or padded with decoration
   2 = off-topic, wrong, or empty

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
      model: adapter.model,
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

import * as meeseeksService from '../services/meeseeks.service.js';
import * as messageService from '../services/message.service.js';
import * as costService from '../services/cost.service.js';
import { emitEvent } from '../services/event.service.js';
import { executeCode, extractCodeBlocks } from '../services/sandbox.service.js';
import { getDefaultAdapter } from '../adapters/index.js';
import { publish } from '../services/pubsub.service.js';
import { triggerImmediate } from './autonomous.manager.js';
import { pino } from 'pino';
import { query } from '../db/pool.js';

const log = pino({ name: 'competition' });

interface Race {
  parentId: string;
  task: string;
  competitorIds: string[];
  startedAt: number;
}

interface StrategyConstraint {
  label: string;
  prompt: string;
}

const STRATEGY_POOL: StrategyConstraint[] = [
  {
    label: 'functional-closures',
    prompt: 'CONSTRAINTS: Use ONLY closures and pure functions. NO classes. NO "new" keyword. NO Map/Set — use plain objects for cache. Compose with higher-order functions.',
  },
  {
    label: 'oop-classes',
    prompt: 'CONSTRAINTS: Use ONLY classes with proper OOP. At least 2 classes. Use private fields or encapsulation. Use AbortController for timeouts.',
  },
  {
    label: 'event-driven',
    prompt: 'CONSTRAINTS: Use EventEmitter pattern (require "events"). All logic must be event-driven — emit events, listen for results. NO direct returns for async work.',
  },
  {
    label: 'promise-pipeline',
    prompt: 'CONSTRAINTS: Use Promise chains with .then()/.catch() — NO async/await. Build a pipeline of transformations. Error handling via .catch() only.',
  },
  {
    label: 'recursive-fp',
    prompt: 'CONSTRAINTS: Use recursion instead of loops. NO for/while/do. Use reduce/map/filter. Implement memoization manually with a plain object. Max 40 lines.',
  },
  {
    label: 'minimal-oneliner',
    prompt: 'CONSTRAINTS: Solve in the FEWEST lines possible. Target under 25 lines. No verbose variable names. Compact but readable. Prove that simple beats complex.',
  },
];

function pickTwoStrategies(): [StrategyConstraint, StrategyConstraint] {
  const shuffled = [...STRATEGY_POOL].sort(() => Math.random() - 0.5);
  return [shuffled[0]!, shuffled[1]!];
}

const activeRaces = new Map<string, Race>();
const RACE_CHECK_INTERVAL_MS = 5_000;
const MIN_RESPONSES_BEFORE_JUDGE = 1;
const FORCE_JUDGE_AFTER_MS = 120_000;

let interval: ReturnType<typeof setInterval> | null = null;

export function start(): void {
  interval = setInterval(checkRaces, RACE_CHECK_INTERVAL_MS);
  log.info('Competition manager started');
}

export function stop(): void {
  if (interval) clearInterval(interval);
  interval = null;
}

export async function startRace(task: string, harness?: string): Promise<{ parentId: string; competitors: string[] }> {
  const parent = await meeseeksService.create({ task, role: 'worker', harness });
  const [stratA, stratB] = pickTwoStrategies();
  const strategies = [stratA, stratB];
  const competitors: string[] = [];

  for (const strat of strategies) {
    const child = await meeseeksService.create({ task, parentId: parent.id, harness });
    await query(`UPDATE meeseeks SET strategy = $2 WHERE id = $1`, [child.id, strat.label]);

    const msg = await messageService.create(
      child.id, 'system',
      `COMPETITION MODE! You are competing against another Meeseeks.\n${strat.prompt}\nAnother agent is solving this with DIFFERENT constraints. Your code MUST follow YOUR constraints or you LOSE.\nInclude [TASK COMPLETE] when done.`,
    );
    publish({ type: 'message:new', data: { meeseeksId: child.id, message: msg } });
    competitors.push(child.id);
    publish({ type: 'meeseeks:spawned', data: { ...child, strategy: strat.label } });
    triggerImmediate(child.id);
  }

  await meeseeksService.kill(parent.id, 'Split into competitors');
  await meeseeksService.markDead(parent.id);

  const race: Race = { parentId: parent.id, task, competitorIds: competitors, startedAt: Date.now() };
  activeRaces.set(parent.id, race);

  publish({ type: 'race:started', data: { parentId: parent.id, competitors, task } });
  log.info({ competitors: competitors.map(c => c.slice(0, 8)), strategies: strategies.map(s => s.label) }, 'Race started');
  return { parentId: parent.id, competitors };
}

async function checkRaces(): Promise<void> {
  for (const [raceId, race] of activeRaces) {
    try {
      const competitors = await Promise.all(race.competitorIds.map(id => meeseeksService.getById(id)));
      const valid = competitors.filter(Boolean) as import('../models/index.js').Meeseeks[];
      const alive = valid.filter(c => c.status === 'alive');

      // Both dead (killed by autonomous manager convergence) — judge post-mortem
      if (alive.length === 0) {
        log.info({ raceId: raceId.slice(0, 8) }, 'Both competitors dead — judging post-mortem');
        await judgeRace(race, valid);
        activeRaces.delete(raceId);
        continue;
      }

      const responseCounts = await Promise.all(
        valid.map(async (c) => {
          const msgs = await messageService.getAll(c.id);
          return { id: c.id, count: msgs.filter(m => m.role === 'assistant').length };
        }),
      );

      const allReady = responseCounts.every(r => r.count >= MIN_RESPONSES_BEFORE_JUDGE);
      const anyCompleted = await checkForCompletion(valid);
      const timedOut = Date.now() - race.startedAt > FORCE_JUDGE_AFTER_MS;

      if ((allReady && anyCompleted) || timedOut) {
        if (responseCounts.some(r => r.count >= 1)) {
          log.info({ raceId: raceId.slice(0, 8), reason: timedOut ? 'timeout' : 'completion' }, 'Judging race');
          await judgeRace(race, valid);
        }
        activeRaces.delete(raceId);
      }
    } catch (err) {
      log.error(err, `Race check error for ${raceId.slice(0, 8)}`);
    }
  }
}

async function checkForCompletion(competitors: import('../models/index.js').Meeseeks[]): Promise<boolean> {
  for (const c of competitors) {
    if (c.status !== 'alive') continue;
    const msgs = await messageService.getRecent(c.id, 1);
    if (msgs[0]?.role === 'assistant' && msgs[0].content.includes('[TASK COMPLETE]')) return true;
  }
  return false;
}

async function judgeRace(race: Race, competitors: import('../models/index.js').Meeseeks[]): Promise<void> {
  const entries: { id: string; content: string; tokens: number; execScore: number; execMs: number; execOk: boolean }[] = [];

  for (const c of competitors) {
    const messages = await messageService.getAll(c.id);
    const assistantMsgs = messages.filter(m => m.role === 'assistant');
    const lastResponse = assistantMsgs[assistantMsgs.length - 1]?.content ?? '';

    let execScore = 0;
    let execMs = 0;
    let execOk = false;

    const codeBlocks = extractCodeBlocks(lastResponse);
    if (codeBlocks.length > 0) {
      const result = await executeCode(codeBlocks[0]!);
      execOk = result.success;
      execMs = result.durationMs;

      if (result.success) execScore += 4;
      if (result.durationMs < 1000) execScore += 2;
      if (result.output.trim().length > 0) execScore += 2;
      if (codeBlocks[0]!.split('\n').length <= 60) execScore += 1;
    }

    entries.push({ id: c.id, content: lastResponse.slice(0, 1500), tokens: c.total_tokens, execScore, execMs, execOk });
  }

  if (entries.length < 2) return;

  const scores = entries.map(e => e.execScore);
  if (entries[0]!.tokens > entries[1]!.tokens) scores[1]! += 1;
  else if (entries[1]!.tokens > entries[0]!.tokens) scores[0]! += 1;

  let winnerId: string;
  let loserId: string;
  let reason: string;

  const diff = scores[0]! - scores[1]!;

  if (Math.abs(diff) >= 2) {
    const winIdx = diff > 0 ? 0 : 1;
    winnerId = entries[winIdx]!.id;
    loserId = entries[1 - winIdx]!.id;
    reason = `Objective: ${scores[winIdx]}pts vs ${scores[1 - winIdx]}pts (exec:${entries[winIdx]!.execOk ? 'OK' : 'FAIL'} ${entries[winIdx]!.execMs}ms)`;
    log.info({ scores, reason }, 'Objective winner');
  } else {
    const adapter = getDefaultAdapter();
    try {
      const result = await adapter.chat({
        messages: [{
          role: 'user',
          content: `JUDGE: Two agents competed. Task: "${race.task}"
Scores: A=${scores[0]}pts (exec:${entries[0]!.execOk ? 'OK' : 'FAIL'}, ${entries[0]!.execMs}ms, ${entries[0]!.tokens}t) | B=${scores[1]}pts (exec:${entries[1]!.execOk ? 'OK' : 'FAIL'}, ${entries[1]!.execMs}ms, ${entries[1]!.tokens}t)

A: ${entries[0]!.content.slice(0, 800)}
B: ${entries[1]!.content.slice(0, 800)}

Tied scores. TIEBREAKER: "A" or "B" + one sentence why.`,
        }],
        model: adapter.model,
        maxTokens: 60,
        temperature: 0,
      });

      const isB = result.content.trim().toUpperCase().startsWith('B');
      winnerId = isB ? entries[1]!.id : entries[0]!.id;
      loserId = isB ? entries[0]!.id : entries[1]!.id;
      reason = `Tiebreak (${scores[0]}v${scores[1]}): ${result.content.trim().slice(0, 80)}`;

      await costService.record({
        meeseeks_id: winnerId, model: adapter.model,
        input_tokens: result.inputTokens, output_tokens: result.outputTokens,
        cost: costService.calculateCost(adapter.model, result.inputTokens, result.outputTokens),
      });
    } catch {
      const winIdx = scores[0]! >= scores[1]! ? 0 : 1;
      winnerId = entries[winIdx]!.id;
      loserId = entries[1 - winIdx]!.id;
      reason = `Fallback (${scores[0]}v${scores[1]})`;
    }
  }

  await emitEvent(winnerId, 'strategy_updated', { outcome: 'won', reason });
  await emitEvent(loserId, 'race_lost', { winner: winnerId, reason });

  const winner = await meeseeksService.getById(winnerId);
  if (winner) {
    // Update death_reason even if already dead (post-mortem judgment)
    await query(`UPDATE meeseeks SET death_reason = $2 WHERE id = $1`, [winnerId, `🏆 WON! ${reason.slice(0, 80)}`]);
    if (winner.status === 'alive') {
      await meeseeksService.kill(winnerId, `🏆 WON! ${reason.slice(0, 80)}`);
      setTimeout(() => meeseeksService.markDead(winnerId), 2000);
    }
  }

  const loser = await meeseeksService.getById(loserId);
  if (loser) {
    await query(`UPDATE meeseeks SET lost_race = true, death_reason = $2 WHERE id = $1`, [loserId, `💀 LOST. ${reason.slice(0, 80)}`]);
    if (loser.status === 'alive') {
      await meeseeksService.kill(loserId, `💀 LOST. ${reason.slice(0, 80)}`);
      setTimeout(() => meeseeksService.markDead(loserId), 2000);
    }
  }

  publish({
    type: 'race:finished',
    data: {
      winnerId,
      loserId,
      reason,
      scores: Object.fromEntries(entries.map((e, i) => [e.id, scores[i]!])),
    },
  });
  log.info({ winner: winnerId.slice(0, 8), loser: loserId.slice(0, 8), scores, reason: reason.slice(0, 60) }, 'Race judged');
}

export function getActiveRaces(): Race[] {
  return Array.from(activeRaces.values());
}

import { pino } from 'pino';
import { query } from '../db/pool.js';
import type { Strategy, StrategyParams } from './strategy-memory.service.js';
import { getDefaultEmbeddingAdapter } from '../adapters/index.js';

const log = pino({ name: 'learned-strategy' });

// === INTERFACES ===

export interface LearnedStrategy {
  id: string;
  task_pattern: string;
  task_text: string | null;
  task_embedding: string | null; // pgvector returns as '[0.1,0.2,...]' string — never deserialized in JS
  strategy_name: string;
  strategy_params: StrategyParams;
  code_template: string;
  avg_score: number;
  success_count: number;
  env_scores: Record<string, { avg: number; count: number }>;
  source_meeseeks_id: string | null;
  learned_from_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// === TASK PATTERN EXTRACTION ===

/**
 * Extracts a normalized task pattern from a task description.
 * Used to match similar tasks for strategy reuse.
 */
export function extractTaskPattern(task: string): string {
  const lower = task.toLowerCase();
  
  if (/fetch.*retry|retry.*fetch|fetchWithRetry/i.test(lower)) {
    return 'fetchWithRetry';
  }
  if (/rate.*limit|rateLimiter|throttle/i.test(lower)) {
    return 'rateLimiter';
  }
  if (/lru.*cache|cache.*lru|lrucache/i.test(lower)) {
    return 'LRUCache';
  }
  if (/circuit.*break|circuitBreaker/i.test(lower)) {
    return 'circuitBreaker';
  }
  if (/debounce/i.test(lower)) {
    return 'debounce';
  }
  if (/memoize|memoization/i.test(lower)) {
    return 'memoize';
  }
  if (/promise.*pool|runWithLimit|concurrent.*limit|concurrency.*cap/i.test(lower)) {
    return 'promisePool';
  }

  return 'generic';
}

// === PERSISTENCE FUNCTIONS ===

/**
 * Save or update a learned strategy in the database.
 * Uses UPSERT with cumulative average calculation.
 */
export async function saveLearnedStrategy(
  taskPattern: string,
  strategy: Strategy,
  code: string,
  score: number,
  env: string,
  meeseeksId?: string,
  taskText?: string,
): Promise<void> {
  console.log('[saveLearnedStrategy CALLED]', { taskPattern, strategy: strategy.name, score, meeseeksId: meeseeksId?.slice(0, 8), taskText: taskText?.slice(0, 60) ?? 'UNDEFINED' });
  // Generate embedding for the task text (fire-and-forget on failure)
  let embeddingStr: string | null = null;
  if (taskText) {
    try {
      const adapter = getDefaultEmbeddingAdapter();
      const vec = await adapter.embed(taskText);
      embeddingStr = `[${vec.join(',')}]`;
    } catch (err) {
      log.warn({ err }, 'Embedding generation failed — saving strategy without vector');
    }
  }

  try {
    // First, try to get existing strategy to calculate cumulative average
    const existing = await query<LearnedStrategy>(
      `SELECT id, avg_score, success_count, env_scores, source_meeseeks_id, learned_from_id,
              task_embedding
       FROM learned_strategies
       WHERE task_pattern = $1 AND strategy_name = $2`,
      [taskPattern, strategy.name]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const newCount = row.success_count + 1;
      const newAvg = (row.avg_score * row.success_count + score) / newCount;

      const envScores = row.env_scores || {};
      const envData = envScores[env] || { avg: 0, count: 0 };
      envScores[env] = {
        avg: (envData.avg * envData.count + score) / (envData.count + 1),
        count: envData.count + 1,
      };

      // Only backfill task_text / task_embedding if not already stored
      if (embeddingStr && !row.task_embedding) {
        await query(
          `UPDATE learned_strategies
           SET avg_score = $1,
               success_count = $2,
               env_scores = $3,
               strategy_params = $4,
               code_template = CASE WHEN $5 > avg_score THEN $6 ELSE code_template END,
               learned_from_id = COALESCE($9, learned_from_id),
               task_text = COALESCE(task_text, $10),
               task_embedding = COALESCE(task_embedding, $11::vector)
           WHERE task_pattern = $7 AND strategy_name = $8`,
          [newAvg, newCount, JSON.stringify(envScores), JSON.stringify(strategy.params),
           score, code, taskPattern, strategy.name, meeseeksId ?? null,
           taskText ?? null, embeddingStr]
        );
      } else {
        await query(
          `UPDATE learned_strategies
           SET avg_score = $1,
               success_count = $2,
               env_scores = $3,
               strategy_params = $4,
               code_template = CASE WHEN $5 > avg_score THEN $6 ELSE code_template END,
               learned_from_id = COALESCE($9, learned_from_id),
               task_text = COALESCE(task_text, $10)
           WHERE task_pattern = $7 AND strategy_name = $8`,
          [newAvg, newCount, JSON.stringify(envScores), JSON.stringify(strategy.params),
           score, code, taskPattern, strategy.name, meeseeksId ?? null,
           taskText ?? null]
        );
      }

      // Registrar cadena: source_id = quien lo usó antes que yo (learned_from_id),
      // no el creador original. Esto forma A→B→C→D en vez de estrella A←B,A←C,A←D
      if (meeseeksId) {
        const predecessor = row.learned_from_id ?? row.source_meeseeks_id ?? null;
        // Solo insertar si el predecesor es diferente a mí mismo
        if (predecessor !== meeseeksId) {
          await query(
            `INSERT INTO strategy_learnings (strategy_id, learner_id, source_id, task_pattern, strategy_name, score)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [row.id ?? null, meeseeksId, predecessor, taskPattern, strategy.name, score]
          ).catch(() => {});
        }
      }

      log.info({ taskPattern, strategy: strategy.name, newAvg: newAvg.toFixed(2), count: newCount }, 'Updated learned strategy');
    } else {
      const envScores = { [env]: { avg: score, count: 1 } };

      const inserted = await query<{ id: string }>(
        embeddingStr
          ? `INSERT INTO learned_strategies
             (task_pattern, strategy_name, strategy_params, code_template, avg_score, success_count,
              env_scores, source_meeseeks_id, task_text, task_embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector) RETURNING id`
          : `INSERT INTO learned_strategies
             (task_pattern, strategy_name, strategy_params, code_template, avg_score, success_count,
              env_scores, source_meeseeks_id, task_text)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        embeddingStr
          ? [taskPattern, strategy.name, JSON.stringify(strategy.params), code,
             score, 1, JSON.stringify(envScores), meeseeksId ?? null,
             taskText ?? null, embeddingStr]
          : [taskPattern, strategy.name, JSON.stringify(strategy.params), code,
             score, 1, JSON.stringify(envScores), meeseeksId ?? null,
             taskText ?? null]
      );

      // Primer aprendiz — source_id null (él mismo lo creó)
      if (meeseeksId && inserted.rows[0]) {
        await query(
          `INSERT INTO strategy_learnings (strategy_id, learner_id, source_id, task_pattern, strategy_name, score)
           VALUES ($1, $2, NULL, $3, $4, $5)`,
          [inserted.rows[0].id, meeseeksId, taskPattern, strategy.name, score]
        ).catch(() => {});
      }

      log.info({ taskPattern, strategy: strategy.name, score }, 'Saved new learned strategy');
    }
  } catch (err) {
    log.error({ err, taskPattern, strategy: strategy.name }, 'Failed to save learned strategy');
    console.error('[saveLearnedStrategy ERROR]', taskPattern, strategy.name, err);
  }
}

/**
 * Get top strategies for a task pattern, ordered by average score.
 */
export async function getLearnedStrategies(
  taskPattern: string,
  limit: number = 3
): Promise<LearnedStrategy[]> {
  try {
    const result = await query<LearnedStrategy>(
      `SELECT * FROM learned_strategies 
       WHERE task_pattern = $1 
       ORDER BY avg_score DESC 
       LIMIT $2`,
      [taskPattern, limit]
    );

    return result.rows.map(row => ({
      ...row,
      strategy_params: typeof row.strategy_params === 'string' 
        ? JSON.parse(row.strategy_params) 
        : row.strategy_params,
      env_scores: typeof row.env_scores === 'string'
        ? JSON.parse(row.env_scores)
        : row.env_scores,
    }));
  } catch (err) {
    log.error({ err, taskPattern }, 'Failed to get learned strategies');
    return [];
  }
}

/**
 * Semantic strategy search using cosine similarity on task embeddings.
 * Falls back to empty array if embedding generation fails or no rows have vectors yet.
 * minSimilarity: 0.65 is a good starting threshold for task description similarity.
 */
export async function getLearnedStrategiesSemantic(
  taskText: string,
  limit = 3,
  minSimilarity = 0.65,
): Promise<LearnedStrategy[]> {
  try {
    const adapter = getDefaultEmbeddingAdapter();
    const vec = await adapter.embed(taskText);
    const vectorLiteral = `[${vec.join(',')}]`;

    const result = await query<LearnedStrategy>(
      // 1 - cosine_distance = cosine_similarity
      `SELECT *, 1 - (task_embedding <=> $1::vector) AS similarity
       FROM learned_strategies
       WHERE task_embedding IS NOT NULL
         AND 1 - (task_embedding <=> $1::vector) >= $2
       ORDER BY task_embedding <=> $1::vector
       LIMIT $3`,
      [vectorLiteral, minSimilarity, limit],
    );

    if (result.rows.length === 0) return [];

    return result.rows.map(row => ({
      ...row,
      strategy_params: typeof row.strategy_params === 'string'
        ? JSON.parse(row.strategy_params)
        : row.strategy_params,
      env_scores: typeof row.env_scores === 'string'
        ? JSON.parse(row.env_scores)
        : row.env_scores,
    }));
  } catch (err) {
    log.warn({ err, taskText: taskText.slice(0, 80) }, 'Semantic search failed — skipping memory injection');
    return [];
  }
}

/**
 * Get the ancestry chain for a learner: [direct predecessor, grandparent, ...]
 * Uses strategy_learnings table. Max 5 levels deep.
 */
/**
 * Returns the most recent learner of a strategy that is NOT excludeId.
 * Used at iter 1 when the new agent has no rows yet.
 */
export async function getLastLearner(
  strategyName: string,
  excludeId: string
): Promise<string | null> {
  const result = await query<{ learner_id: string }>(
    `SELECT learner_id FROM strategy_learnings
     WHERE strategy_name = $1 AND learner_id != $2
     ORDER BY learned_at DESC LIMIT 1`,
    [strategyName, excludeId]
  ).catch(() => null);
  return result?.rows[0]?.learner_id ?? null;
}

/**
 * Returns the most recent predecessor of learnerId (excluding itself).
 * Uses strategy_learnings table.
 */
export async function getDirectPredecessor(
  learnerId: string,
  strategyName: string
): Promise<string | null> {
  const result = await query<{ source_id: string }>(
    `SELECT source_id FROM strategy_learnings
     WHERE learner_id = $1 AND strategy_name = $2
       AND source_id IS NOT NULL AND source_id != $1
     ORDER BY learned_at DESC LIMIT 1`,
    [learnerId, strategyName]
  ).catch(() => null);
  return result?.rows[0]?.source_id ?? null;
}

/**
 * Walk ancestry chain starting from startId.
 * Returns [startId's source, grandparent, great-grandparent, ...]
 */
export async function getAncestryChain(
  startId: string,
  strategyName: string
): Promise<string[]> {
  const chain: string[] = [];
  const visited = new Set<string>();
  let current = startId;

  for (let depth = 0; depth < 20; depth++) {
    if (visited.has(current)) break;
    visited.add(current);

    const result = await query<{ source_id: string }>(
      `SELECT source_id FROM strategy_learnings
       WHERE learner_id = $1 AND strategy_name = $2
         AND source_id IS NOT NULL AND source_id != $1
       ORDER BY learned_at DESC LIMIT 1`,
      [current, strategyName]
    ).catch(() => null);

    const sourceId = result?.rows[0]?.source_id;
    if (!sourceId || visited.has(sourceId)) break;
    chain.push(sourceId);
    current = sourceId;
  }

  return chain;
}

/**
 * Get global best strategies across all task patterns.
 */
export async function getGlobalBestStrategies(limit: number = 5): Promise<LearnedStrategy[]> {
  try {
    const result = await query<LearnedStrategy>(
      `SELECT * FROM learned_strategies 
       ORDER BY avg_score DESC, success_count DESC 
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      ...row,
      strategy_params: typeof row.strategy_params === 'string'
        ? JSON.parse(row.strategy_params)
        : row.strategy_params,
      env_scores: typeof row.env_scores === 'string'
        ? JSON.parse(row.env_scores)
        : row.env_scores,
    }));
  } catch (err) {
    log.error({ err }, 'Failed to get global best strategies');
    return [];
  }
}

/**
 * Check if we have any learned strategies for a task pattern.
 */
export async function hasLearnedStrategies(taskPattern: string): Promise<boolean> {
  try {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM learned_strategies WHERE task_pattern = $1`,
      [taskPattern]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  } catch (err) {
    log.error({ err, taskPattern }, 'Failed to check learned strategies');
    return false;
  }
}

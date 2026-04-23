import { randomUUID } from 'crypto';
import { pino } from 'pino';
import type { EmbeddingAdapter } from '../adapters/embedding.types.js';
import { StorageService, type StrategyRecord } from './storage.service.js';

const log = pino({ name: 'strategy-memory' });

export interface SaveStrategyOpts {
  task: string;
  strategyName: string;
  strategyParams?: Record<string, unknown>;
  code: string;
  score: number;
  env?: string;
  minScore?: number;
}

export class StrategyMemoryService {
  private storage: StorageService;
  private embedding?: EmbeddingAdapter;

  constructor(storage: StorageService, embeddingAdapter?: EmbeddingAdapter) {
    this.storage = storage;
    this.embedding = embeddingAdapter;
  }

  async save(opts: SaveStrategyOpts): Promise<void> {
    const minScore = opts.minScore ?? 8;
    if (opts.score < minScore) return; // only save quality solutions

    const pattern = extractTaskPattern(opts.task);
    let taskEmbedding: number[] | null = null;

    if (this.embedding) {
      try {
        taskEmbedding = await this.embedding.embed(opts.task);
      } catch (err) {
        log.warn({ err }, 'Embedding failed — saving without vector');
      }
    }

    const envScores: Record<string, { avg: number; count: number }> = {};
    if (opts.env) {
      envScores[opts.env] = { avg: opts.score, count: 1 };
    }

    this.storage.save({
      id: randomUUID(),
      task_pattern: pattern,
      task_text: opts.task,
      task_embedding: taskEmbedding,
      strategy_name: opts.strategyName,
      strategy_params: opts.strategyParams ?? {},
      code_template: opts.code,
      avg_score: opts.score,
      success_count: 1,
      env_scores: envScores,
    });

    log.info({ pattern, strategy: opts.strategyName, score: opts.score }, 'Strategy saved');
  }

  async search(task: string, limit = 3): Promise<StrategyRecord[]> {
    const pattern = extractTaskPattern(task);

    if (pattern !== 'generic') {
      const results = this.storage.findByPattern(pattern, limit);
      if (results.length > 0) return results;
    }

    // Semantic search fallback for generic tasks or when exact match returns nothing
    if (this.embedding) {
      try {
        const embedding = await this.embedding.embed(task);
        return this.storage.findBySimilarity(embedding, limit);
      } catch (err) {
        log.warn({ err }, 'Semantic search failed — falling back to generic pattern');
      }
    }

    // Last resort: return any generic strategies by score
    return this.storage.findByPattern('generic', limit);
  }

  extractTaskPattern(task: string): string {
    return extractTaskPattern(task);
  }
}

export function extractTaskPattern(task: string): string {
  const lower = task.toLowerCase();

  if (/fetch.*retry|retry.*fetch|fetchwithretry/i.test(lower)) return 'fetchWithRetry';
  if (/rate.*limit|ratelimiter|throttle/i.test(lower)) return 'rateLimiter';
  if (/lru.*cache|cache.*lru|lrucache/i.test(lower)) return 'LRUCache';
  if (/circuit.*break|circuitbreaker/i.test(lower)) return 'circuitBreaker';
  if (/promise.*pool|runwithlimit|concurrent.*limit|concurrency.*cap/i.test(lower)) return 'promisePool';
  if (/debounce/i.test(lower)) return 'debounce';
  if (/memoize|memoization/i.test(lower)) return 'memoize';

  return 'generic';
}

export function buildMemoryPrompt(strategies: StrategyRecord[]): string {
  if (strategies.length === 0) return '';

  const lines = ['=== PROVEN STRATEGIES FOR SIMILAR TASKS ==='];
  for (const s of strategies) {
    lines.push(`• ${s.strategy_name}: avg=${s.avg_score.toFixed(1)}/10 (${s.success_count} wins)`);
    if (Object.keys(s.strategy_params).length > 0) {
      lines.push(`  Params: ${JSON.stringify(s.strategy_params)}`);
    }
    if (s.code_template) {
      lines.push(`  Code pattern:\n${s.code_template.slice(0, 400)}`);
    }
  }
  lines.push('RECOMMENDATION: Start with one of the proven strategies above.');
  return lines.join('\n');
}

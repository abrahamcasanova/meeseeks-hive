import type { LLMAdapter } from './adapters/llm.types.js';
import type { EmbeddingAdapter } from './adapters/embedding.types.js';
import { StorageService } from './services/storage.service.js';
import { StrategyMemoryService } from './services/strategy-memory.service.js';
import { qualityGate } from './gate/quality-gate.js';
import type { QualityGateResult, IterationInfo } from './gate/quality-gate.js';

export interface MeeseeksSDKConfig {
  /** LLM adapter used to generate code/responses */
  adapter: LLMAdapter;
  /** Optional separate adapter for judging — avoids judge == generator bias in free mode */
  judgeAdapter?: LLMAdapter;
  /** Path to SQLite database file. Default: '.meeseeks/memory.db' */
  storage?: string;
  /** Optional embedding adapter — enables semantic search for knowledge inheritance */
  embeddingAdapter?: EmbeddingAdapter;
  /** Project context injected into the judge prompt (e.g. 'TypeScript + Express + PostgreSQL') */
  projectContext?: string;
  /** Minimum score to consider a result passing. Default: 8 */
  minScore?: number;
}

export interface RunOptions {
  /** The task to complete */
  task: string;
  /** Iteration mode: fast=1 iter, balanced=3 iters (default), quality=5 iters */
  mode?: 'fast' | 'balanced' | 'quality';
  /** Harness plugin id. Auto-detected from task if not specified */
  harness?: string;
  /** Override the config-level minScore for this run */
  minScore?: number;
  /** Override the config-level projectContext for this run */
  projectContext?: string;
  /** Called after each iteration with progress info */
  onIteration?: (info: IterationInfo) => void;
}

export class MeeseeksSDK {
  private memory: StrategyMemoryService;
  private storage: StorageService;
  private config: MeeseeksSDKConfig;

  constructor(config: MeeseeksSDKConfig) {
    const dbPath = config.storage ?? '.meeseeks/memory.db';
    this.storage = new StorageService(dbPath);
    this.memory = new StrategyMemoryService(this.storage, config.embeddingAdapter);
    this.config = config;
  }

  static async create(config: MeeseeksSDKConfig): Promise<MeeseeksSDK> {
    const dbPath = config.storage ?? '.meeseeks/memory.db';
    const storage = await StorageService.create(dbPath);
    const sdk = Object.create(MeeseeksSDK.prototype) as MeeseeksSDK;
    sdk.storage = storage;
    sdk.memory = new StrategyMemoryService(storage, config.embeddingAdapter);
    sdk.config = config;
    return sdk;
  }

  async run(opts: RunOptions): Promise<QualityGateResult> {
    return qualityGate({
      task: opts.task,
      adapter: this.config.adapter,
      judgeAdapter: this.config.judgeAdapter,
      harness: opts.harness ?? this.detectHarness(opts.task),
      minScore: opts.minScore ?? this.config.minScore ?? 8,
      projectContext: opts.projectContext ?? this.config.projectContext,
      memory: this.memory,
      mode: opts.mode ?? 'balanced',
      onIteration: opts.onIteration,
    });
  }

  close(): void {
    this.storage.close();
  }

  private detectHarness(task: string): string {
    const lower = task.toLowerCase();
    if (/fetchwithretry|fetch.*retry|retry.*fetch/i.test(lower)) return 'js-api';
    if (/lrucache|lru.*cache|cache.*lru/i.test(lower)) return 'js-lrucache';
    if (/ratelimiter|rate.*limit/i.test(lower)) return 'js-ratelimiter';
    if (/circuitbreaker|circuit.*break/i.test(lower)) return 'js-circuitbreaker';
    if (/runwithlimit|promise.*pool/i.test(lower)) return 'js-promisepool';
    if (/tictactoe|tic.*tac.*toe/i.test(lower)) return 'js-tictactoe';
    if (/maze.*solver|findpath/i.test(lower)) return 'js-maze';
    if (/sudoku/i.test(lower)) return 'js-sudoku';
    if (/wordle/i.test(lower)) return 'js-wordle';
    return 'free';
  }
}

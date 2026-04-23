import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export interface StrategyRecord {
  id: string;
  task_pattern: string;
  task_text: string;
  task_embedding: number[] | null;
  strategy_name: string;
  strategy_params: Record<string, unknown>;
  code_template: string;
  avg_score: number;
  success_count: number;
  env_scores: Record<string, { avg: number; count: number }>;
  created_at: string;
  updated_at: string;
}

const CREATE_STRATEGIES = `
CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  task_pattern TEXT NOT NULL,
  task_text TEXT NOT NULL,
  task_embedding TEXT,
  strategy_name TEXT NOT NULL,
  strategy_params TEXT DEFAULT '{}',
  code_template TEXT DEFAULT '',
  avg_score REAL DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  env_scores TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`;

const CREATE_LEARNINGS = `
CREATE TABLE IF NOT EXISTS strategy_learnings (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  score REAL NOT NULL,
  task_text TEXT,
  source_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_strategies_pattern ON strategies(task_pattern);
CREATE INDEX IF NOT EXISTS idx_strategies_score ON strategies(avg_score DESC);
`;

export class StorageService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(CREATE_STRATEGIES + CREATE_LEARNINGS + CREATE_INDEXES);
  }

  static async create(dbPath: string): Promise<StorageService> {
    await mkdir(dirname(dbPath), { recursive: true });
    return new StorageService(dbPath);
  }

  save(record: Omit<StrategyRecord, 'created_at' | 'updated_at'>): void {
    const existing = this.db.prepare(
      'SELECT avg_score, success_count, env_scores FROM strategies WHERE task_pattern = ? AND strategy_name = ?'
    ).get(record.task_pattern, record.strategy_name) as Pick<StrategyRecord, 'avg_score' | 'success_count' | 'env_scores'> | undefined;

    if (existing) {
      const newCount = existing.success_count + 1;
      const newAvg = (existing.avg_score * existing.success_count + record.avg_score) / newCount;
      const envScores = typeof existing.env_scores === 'string'
        ? JSON.parse(existing.env_scores as unknown as string)
        : existing.env_scores;

      this.db.prepare(`
        UPDATE strategies SET
          avg_score = ?,
          success_count = ?,
          env_scores = ?,
          code_template = CASE WHEN ? > avg_score THEN ? ELSE code_template END,
          task_embedding = COALESCE(task_embedding, ?),
          updated_at = datetime('now')
        WHERE task_pattern = ? AND strategy_name = ?
      `).run(
        newAvg,
        newCount,
        JSON.stringify(envScores),
        record.avg_score, record.code_template,
        record.task_embedding ? JSON.stringify(record.task_embedding) : null,
        record.task_pattern,
        record.strategy_name,
      );
    } else {
      this.db.prepare(`
        INSERT INTO strategies (id, task_pattern, task_text, task_embedding, strategy_name, strategy_params, code_template, avg_score, success_count, env_scores)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        record.id,
        record.task_pattern,
        record.task_text,
        record.task_embedding ? JSON.stringify(record.task_embedding) : null,
        record.strategy_name,
        JSON.stringify(record.strategy_params),
        record.code_template,
        record.avg_score,
        JSON.stringify(record.env_scores),
      );
    }
  }

  findByPattern(pattern: string, limit = 3): StrategyRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM strategies WHERE task_pattern = ? ORDER BY avg_score DESC LIMIT ?'
    ).all(pattern, limit) as Array<Record<string, unknown>>;
    return rows.map(r => this.deserialize(r));
  }

  findBySimilarity(embedding: number[], limit = 3, minSimilarity = 0.65): StrategyRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM strategies WHERE task_embedding IS NOT NULL'
    ).all() as Array<Record<string, unknown>>;

    return rows
      .map(r => {
        const parsed = this.deserialize(r);
        const emb = parsed.task_embedding;
        if (!emb) return null;
        return { record: parsed, sim: cosineSimilarity(embedding, emb) };
      })
      .filter((x): x is { record: StrategyRecord; sim: number } => x !== null && x.sim >= minSimilarity)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, limit)
      .map(x => x.record);
  }

  close(): void {
    this.db.close();
  }

  private deserialize(row: Record<string, unknown>): StrategyRecord {
    return {
      id: row.id as string,
      task_pattern: row.task_pattern as string,
      task_text: row.task_text as string,
      task_embedding: row.task_embedding ? JSON.parse(row.task_embedding as string) : null,
      strategy_name: row.strategy_name as string,
      strategy_params: JSON.parse((row.strategy_params as string) ?? '{}'),
      code_template: (row.code_template as string) ?? '',
      avg_score: row.avg_score as number,
      success_count: row.success_count as number,
      env_scores: JSON.parse((row.env_scores as string) ?? '{}'),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

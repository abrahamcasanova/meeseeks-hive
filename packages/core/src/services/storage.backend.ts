import type { StrategyRecord } from './storage.service.js';

/**
 * Pluggable storage backend for strategy memory.
 * Implement this interface to use any database (Postgres, MySQL, etc.)
 * instead of the default SQLite backend.
 */
export interface StorageBackend {
  save(record: Omit<StrategyRecord, 'created_at' | 'updated_at'>): Promise<void>;
  findByPattern(pattern: string, limit?: number): Promise<StrategyRecord[]>;
  findBySimilarity(embedding: number[], limit?: number, minSimilarity?: number): Promise<StrategyRecord[]>;
  close(): Promise<void>;
}

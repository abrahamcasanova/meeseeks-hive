/**
 * Tests for StrategyMemoryService — knowledge inheritance across tournaments.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../services/storage.service.js';
import { StrategyMemoryService, extractTaskPattern } from '../services/strategy-memory.service.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

function tempDb() {
  return join(tmpdir(), `test-${randomUUID()}.db`);
}

// --- extractTaskPattern ---

describe('extractTaskPattern', () => {
  it('detects fetchWithRetry', () => {
    expect(extractTaskPattern('Write fetchWithRetry function')).toBe('fetchWithRetry');
    expect(extractTaskPattern('implement fetch with retry logic')).toBe('fetchWithRetry');
  });

  it('detects rateLimiter', () => {
    expect(extractTaskPattern('implement a rate limiter')).toBe('rateLimiter');
    expect(extractTaskPattern('token bucket ratelimiter')).toBe('rateLimiter');
  });

  it('detects LRUCache', () => {
    expect(extractTaskPattern('build an LRU cache')).toBe('LRUCache');
    expect(extractTaskPattern('lrucache implementation')).toBe('LRUCache');
  });

  it('detects algorithm pattern', () => {
    expect(extractTaskPattern('fibonacci sequence')).toBe('algorithm');
    expect(extractTaskPattern('find if palindrome')).toBe('algorithm');
    expect(extractTaskPattern('binary search in sorted array')).toBe('algorithm');
  });

  it('returns generic for unknown tasks', () => {
    expect(extractTaskPattern('do something random')).toBe('generic');
    expect(extractTaskPattern('')).toBe('generic');
  });

  it('first match wins — fetchWithRetry before rateLimiter', () => {
    expect(extractTaskPattern('fetch with retry and rate limiting')).toBe('fetchWithRetry');
  });
});

// --- StrategyMemoryService ---

describe('StrategyMemoryService — save and search', () => {
  let storage: StorageService;
  let memory: StrategyMemoryService;

  beforeEach(() => {
    storage = new StorageService(tempDb());
    memory = new StrategyMemoryService(storage);
  });

  it('saves and retrieves strategy by pattern', async () => {
    await memory.save({
      task: 'implement fibonacci sequence',
      strategyName: 'MemoizedFib',
      code: 'function fib(n) { const m={}; ... }',
      score: 9,
    });

    const results = await memory.search('write fibonacci function');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.strategy_name).toBe('MemoizedFib');
  });

  it('does not save strategies below minScore', async () => {
    await memory.save({
      task: 'fibonacci',
      strategyName: 'BadFib',
      code: 'function fib(n) { return n; }',
      score: 5, // below default minScore of 8
    });

    const results = await memory.search('fibonacci');
    expect(results.length).toBe(0);
  });

  it('returns higher scored strategy first', async () => {
    await memory.save({ task: 'fibonacci', strategyName: 'Good', code: 'a', score: 9 });
    await memory.save({ task: 'fibonacci', strategyName: 'Better', code: 'b', score: 10 });

    const results = await memory.search('fibonacci sequence');
    expect(results[0]!.strategy_name).toBe('Better');
  });

  it('updates avg_score and success_count on repeated saves', async () => {
    await memory.save({ task: 'fibonacci', strategyName: 'Fib', code: 'a', score: 8 });
    await memory.save({ task: 'fibonacci', strategyName: 'Fib', code: 'b', score: 10 });

    const results = await memory.search('fibonacci');
    expect(results[0]!.success_count).toBe(2);
    expect(results[0]!.avg_score).toBe(9); // (8+10)/2
  });

  it('updates code_template when new score is higher', async () => {
    await memory.save({ task: 'fibonacci', strategyName: 'Fib', code: 'old-code', score: 8 });
    await memory.save({ task: 'fibonacci', strategyName: 'Fib', code: 'new-better-code', score: 10 });

    const results = await memory.search('fibonacci');
    expect(results[0]!.code_template).toBe('new-better-code');
  });

  it('returns empty array when no matching strategies', async () => {
    const results = await memory.search('completely unknown task xyz');
    expect(results).toEqual([]);
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await memory.save({ task: 'fibonacci', strategyName: `Fib${i}`, code: `code${i}`, score: 8 + i * 0.1 });
    }
    const results = await memory.search('fibonacci', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

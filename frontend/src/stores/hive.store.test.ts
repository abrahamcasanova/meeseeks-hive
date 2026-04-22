import { describe, it, expect, beforeEach } from 'vitest';
import { useHiveStore } from './hive.store';
import type { Meeseeks } from '../types';

function makeMeeseeks(overrides: Partial<Meeseeks> = {}): Meeseeks {
  return {
    id: 'test-id-1234',
    task: 'test task',
    status: 'alive',
    role: 'worker',
    model: 'test-model',
    strategy: null,
    parent_id: null,
    spawn_depth: 0,
    stress: 0,
    failed_attempts: 0,
    lost_race: false,
    inherited_strategy_failed: false,
    harness: 'js-api',
    created_at: new Date().toISOString(),
    died_at: null,
    death_reason: null,
    total_tokens: 0,
    total_cost: 0,
    ...overrides,
  } as Meeseeks;
}

beforeEach(() => {
  useHiveStore.setState({
    meeseeks: new Map(),
    selectedId: null,
    memoryInjected: new Set(),
    memoryChain: new Map(),
  });
});

describe('hive.store', () => {
  it('adds a meeseeks', () => {
    const m = makeMeeseeks();
    useHiveStore.getState().setMeeseeks(m);
    expect(useHiveStore.getState().meeseeks.get('test-id-1234')).toBeDefined();
  });

  it('updates a meeseeks', () => {
    const m = makeMeeseeks();
    useHiveStore.getState().setMeeseeks(m);
    useHiveStore.getState().updateMeeseeks('test-id-1234', { stress: 0.75 });
    expect(useHiveStore.getState().meeseeks.get('test-id-1234')?.stress).toBe(0.75);
  });

  it('removes a meeseeks', () => {
    const m = makeMeeseeks();
    useHiveStore.getState().setMeeseeks(m);
    useHiveStore.getState().removeMeeseeks('test-id-1234');
    expect(useHiveStore.getState().meeseeks.size).toBe(0);
  });

  it('sets selected id', () => {
    useHiveStore.getState().setSelected('abc');
    expect(useHiveStore.getState().selectedId).toBe('abc');
    useHiveStore.getState().setSelected(null);
    expect(useHiveStore.getState().selectedId).toBeNull();
  });

  it('tracks memory chain', () => {
    useHiveStore.getState().setMemoryChain('learner-1', 'source-1');
    expect(useHiveStore.getState().memoryChain.get('learner-1')).toBe('source-1');
  });

  it('marks memory injected', () => {
    useHiveStore.getState().markMemoryInjected('agent-1');
    expect(useHiveStore.getState().memoryInjected.has('agent-1')).toBe(true);
  });
});

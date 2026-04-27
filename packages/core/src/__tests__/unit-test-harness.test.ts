/**
 * Tests for buildUnitTestHarness — the most critical piece of js-unit-test scoring.
 * These tests run the harness against real code to verify scoring correctness.
 */
import { describe, it, expect } from 'vitest';
import { executeCode } from '../services/sandbox.service.js';
import { buildUnitTestHarness } from '../services/sandbox.service.js';

// Helper: run harness and parse JSON result
async function runHarness(code: string, params: Record<string, unknown>) {
  const harness = buildUnitTestHarness(code, params);
  const result = await executeCode(harness);
  const lines = result.output.split('\n').filter(l => l.startsWith('{'));
  if (!lines.length) throw new Error(`No JSON output. stderr: ${result.error}`);
  return JSON.parse(lines[lines.length - 1]!);
}

const FIBONACCI_CODE = `
module.exports = function fibonacci(n) {
  const memo = {};
  function fib(k) {
    if (k <= 1) return k;
    if (memo[k]) return memo[k];
    return memo[k] = fib(k-1) + fib(k-2);
  }
  return fib(n);
};`;

const WRONG_FIBONACCI = `
module.exports = function fibonacci(n) {
  return n * 2; // always wrong
};`;

const SLOW_FIBONACCI = `
module.exports = function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n-1) + fibonacci(n-2); // naive recursion — no memo
};`;

// --- Correctness ---

describe('buildUnitTestHarness — correctness', () => {
  it('scores 10 when all tests pass', async () => {
    const result = await runHarness(FIBONACCI_CODE, {
      functionName: 'fibonacci',
      testCases: [
        { input: [0], expected: 0, points: 5 },
        { input: [10], expected: 55, points: 5 },
      ],
    });
    expect(result.score).toBe(10);
    expect(result.success).toBe(true);
    expect(result.env).toBe('unit-test');
  });

  it('scores 0 when all tests fail', async () => {
    const result = await runHarness(WRONG_FIBONACCI, {
      functionName: 'fibonacci',
      testCases: [
        { input: [5], expected: 5, points: 5 },
        { input: [10], expected: 55, points: 5 },
      ],
    });
    expect(result.score).toBe(0);
    expect(result.success).toBe(false);
  });

  it('gives partial credit proportionally', async () => {
    const code = `module.exports = function fibonacci(n) { return n === 0 ? 0 : 999; }`; // only passes n=0
    const result = await runHarness(code, {
      functionName: 'fibonacci',
      testCases: [
        { input: [0], expected: 0, points: 5 }, // passes
        { input: [5], expected: 5, points: 5 },  // fails
      ],
    });
    // earned: 5, total: 10 → score = 5.0 (no speed bonus)
    expect(result.score).toBe(5);
    expect(result.success).toBe(false);
  });

  it('scores exactly 10 when all tests pass (no speed bonus)', async () => {
    const result = await runHarness(FIBONACCI_CODE, {
      functionName: 'fibonacci',
      testCases: Array.from({ length: 10 }, (_, i) => ({
        input: [i],
        expected: [0,1,1,2,3,5,8,13,21,34][i],
        points: 2,
      })),
    });
    expect(result.score).toBe(10);
  });
});

// --- Timeout differentiation ---

describe('buildUnitTestHarness — timeout differentiation', () => {
  it('differentiates memoized vs naive via timeout', async () => {
    // fibonacci(35) is slow enough with naive recursion to timeout in 50ms
    // but fast enough to not stack overflow
    const naiveResult = await runHarness(SLOW_FIBONACCI, {
      functionName: 'fibonacci',
      testCases: [
        { input: [0], expected: 0, points: 2 },
        { input: [1], expected: 1, points: 2 },
        { input: [35], expected: 9227465, points: 6, timeoutMs: 50 },
      ],
    });

    const memoResult = await runHarness(FIBONACCI_CODE, {
      functionName: 'fibonacci',
      testCases: [
        { input: [0], expected: 0, points: 2 },
        { input: [1], expected: 1, points: 2 },
        { input: [35], expected: 9227465, points: 6, timeoutMs: 50 },
      ],
    });

    // Memoized should score higher or equal
    expect(memoResult.score).toBeGreaterThanOrEqual(naiveResult.score);
    // Memoized must pass the hard test
    expect(memoResult.score).toBe(10);
    // Env must be unit-test
    expect(naiveResult.env).toBe('unit-test');
  });

  it('does NOT timeout memoized solution', async () => {
    const result = await runHarness(FIBONACCI_CODE, {
      functionName: 'fibonacci',
      testCases: [
        { input: [40], expected: 102334155, points: 10, timeoutMs: 80 },
      ],
    });
    expect(result.score).toBe(10);
  });
});

// --- Export resolution ---

describe('buildUnitTestHarness — export resolution', () => {
  it('resolves named export: module.exports = { fn }', async () => {
    const code = `module.exports = { fibonacci: function(n) { return n <= 1 ? n : arguments.callee(n-1) + arguments.callee(n-2); } }`;
    const result = await runHarness(code, {
      functionName: 'fibonacci',
      testCases: [{ input: [0], expected: 0, points: 10 }],
    });
    expect(result.score).toBe(10);
  });

  it('returns score 0 with clear error if named export not found', async () => {
    // Named export with wrong key — fibonacci is not in the object
    const code = `module.exports = { wrongName: function() { return 42; } }`;
    const result = await runHarness(code, {
      functionName: 'fibonacci',
      testCases: [{ input: [0], expected: 0, points: 10 }],
    });
    expect(result.score).toBe(0);
    expect(result.breakdown[0]).toContain('not found');
  });

  it('direct export module.exports = fn works regardless of function name', async () => {
    // In JS, module.exports = function anyName(){} exports the function directly
    const code = `module.exports = function anyName(n) { return n <= 1 ? n : anyName(n-1)+anyName(n-2); }`;
    const result = await runHarness(code, {
      functionName: 'fibonacci',
      testCases: [{ input: [0], expected: 0, points: 5 }, { input: [5], expected: 5, points: 5 }],
    });
    expect(result.score).toBe(10);
  });

  it('accepts named export { functionName: fn }', async () => {
    const code = `module.exports = { fibonacci: function(n) { return n <= 1 ? n : 0; } }`;
    const result = await runHarness(code, {
      functionName: 'fibonacci',
      testCases: [{ input: [0], expected: 0, points: 10 }],
    });
    expect(result.score).toBe(10);
  });
});

// --- Deep equality ---

describe('buildUnitTestHarness — deep equality', () => {
  it('compares arrays correctly', async () => {
    const code = `module.exports = function twoSum(nums, target) {
      for (let i = 0; i < nums.length; i++)
        for (let j = i+1; j < nums.length; j++)
          if (nums[i]+nums[j] === target) return [i,j];
      return [];
    };`;
    const result = await runHarness(code, {
      functionName: 'twoSum',
      testCases: [
        { input: [[2,7,11,15], 9], expected: [0,1], points: 5 },
        { input: [[3,2,4], 6], expected: [1,2], points: 5 },
      ],
    });
    expect(result.score).toBe(10);
  });

  it('compares nested objects', async () => {
    const code = `module.exports = function wrap(n) { return { value: n, doubled: n*2 }; }`;
    const result = await runHarness(code, {
      functionName: 'wrap',
      testCases: [
        { input: [5], expected: { value: 5, doubled: 10 }, points: 10 },
      ],
    });
    expect(result.score).toBe(10);
  });

  it('breakdown contains diff info on failure', async () => {
    const code = `module.exports = function f(n) { return n + 1; }`;
    const result = await runHarness(code, {
      functionName: 'f',
      testCases: [{ input: [5], expected: 99, points: 10 }],
    });
    const breakdown = result.breakdown as string[];
    expect(breakdown[0]).toContain('expected');
    expect(breakdown[0]).toContain('got');
  });
});

// --- Edge cases ---

describe('buildUnitTestHarness — edge cases', () => {
  it('handles async function correctly', async () => {
    const code = `module.exports = async function asyncFib(n) {
      await new Promise(r => setTimeout(r, 1));
      return n <= 1 ? n : n; // wrong but async
    };`;
    const result = await runHarness(code, {
      functionName: 'asyncFib',
      testCases: [{ input: [0], expected: 0, points: 10 }],
    });
    expect(result.score).toBe(10);
  });

  it('handles empty test cases array', async () => {
    const result = await runHarness(FIBONACCI_CODE, {
      functionName: 'fibonacci',
      testCases: [],
    });
    expect(result.score).toBe(0);
  });

  it('handles runtime exception in user code', async () => {
    const code = `module.exports = function bad(n) { throw new Error('boom'); }`;
    const result = await runHarness(code, {
      functionName: 'bad',
      testCases: [{ input: [1], expected: 1, points: 10 }],
    });
    expect(result.score).toBe(0);
    expect(result.breakdown[0]).toContain('boom');
  });
});

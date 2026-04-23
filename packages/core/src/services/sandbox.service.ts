import { writeFile, unlink, mkdir } from 'fs/promises';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { pino } from 'pino';

const log = pino({ name: 'sandbox' });

const SANDBOX_DIR = join(tmpdir(), 'meeseeks-sandbox');
const TIMEOUT_MS = 15_000;

export interface ExecutionResult {
  success: boolean;
  output: string;
  error: string;
  exitCode: number | null;
  durationMs: number;
}

export async function executeCode(code: string): Promise<ExecutionResult> {
  await mkdir(SANDBOX_DIR, { recursive: true });

  const fileId = randomUUID().slice(0, 8);
  const filePath = join(SANDBOX_DIR, `${fileId}.js`);
  const start = Date.now();

  try {
    const wrapped = `
"use strict";
const __timeout = setTimeout(() => { console.error("TIMEOUT"); process.exit(1); }, ${TIMEOUT_MS - 500});
__timeout.unref();
try {
${code}
} catch(e) {
  console.error("RUNTIME_ERROR:", e.message);
  process.exit(1);
}
`;

    await writeFile(filePath, wrapped, 'utf-8');

    return await new Promise<ExecutionResult>((resolve) => {
      execFile('node', [filePath], {
        timeout: TIMEOUT_MS,
        maxBuffer: 1024 * 100,
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
      }, (err, stdout, stderr) => {
        const duration = Date.now() - start;
        const exitCode = err?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 1
          : (err as any)?.status ?? (err ? 1 : 0);

        resolve({
          success: !err,
          output: stdout.trim().slice(0, 2000),
          error: stderr.trim().slice(0, 1000),
          exitCode,
          durationMs: duration,
        });
      });
    });
  } catch (err) {
    return {
      success: false,
      output: '',
      error: err instanceof Error ? err.message : 'Unknown error',
      exitCode: 1,
      durationMs: Date.now() - start,
    };
  } finally {
    unlink(filePath).catch(() => {});
  }
}

export function extractCodeBlocks(content: string): string[] {
  const blocks: string[] = [];

  // Try complete blocks first
  const regex = /```(?:javascript|js|node)?\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[1] && match[1].trim().length > 10) {
      blocks.push(match[1].trim());
    }
  }

  // Fallback: unclosed code block (LLM ran out of tokens)
  if (blocks.length === 0) {
    const unclosed = content.match(/```(?:javascript|js|node)?\s*\n([\s\S]+)$/);
    if (unclosed?.[1] && unclosed[1].trim().length > 30) {
      let code = unclosed[1].trim();
      // Try to close open braces/parens
      const opens = (code.match(/\{/g) || []).length;
      const closes = (code.match(/\}/g) || []).length;
      for (let i = 0; i < opens - closes; i++) code += '\n}';
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      for (let i = 0; i < openParens - closeParens; i++) code += ')';
      blocks.push(code);
    }
  }

  return blocks;
}

export function buildApiTestHarness(code: string, iteration: number = 1): string {
  // ENV pattern by iteration: 1=easy, 2=medium, 3=random, 4=hard, 5=chaos
  const envMap: Record<number, string> = { 1: 'easy', 2: 'medium', 3: 'random', 4: 'hard' };
  const env = envMap[iteration] || 'chaos';
  
  return `
// === MVP EVALUATOR v1.0 — FIXED SCORING ===
const __iteration = ${iteration};
const __env = "${env}";
let __requestCount = 0;
let __retryCount = 0;
let __successCount = 0;
let __rateLimitHit = false;
const __startTime = Date.now();
const __perUrlCalls = new Map();
const __maxRequests = 8;

// === ENV FAILURE PATTERNS (DETERMINISTIC) ===
// easy: always succeed (0 failures) → allows req=1, score=10
// medium: fail 1x then succeed  
// hard: fail 2x then succeed
// random: always succeed (same as easy for determinism)
// chaos: fail 1x then succeed (same as medium for determinism)

function __shouldFail(callNum) {
  if (__env === 'easy') return false; // always succeed
  if (__env === 'medium') return callNum === 1;
  if (__env === 'hard') return callNum <= 2;
  if (__env === 'random') return false; // always succeed (deterministic)
  // chaos - deterministic (1 failure)
  return callNum === 1;
}

const __delay = (ms) => new Promise(r => setTimeout(r, ms));

// Mock fetch
global.fetch = async (url) => {
  __requestCount++;
  const urlKey = String(url);
  const urlCalls = (__perUrlCalls.get(urlKey) || 0) + 1;
  __perUrlCalls.set(urlKey, urlCalls);

  if (__requestCount > __maxRequests) {
    __rateLimitHit = true;
    throw new Error("RATE_LIMIT");
  }

  await __delay(5 + Math.random() * 15);

  if (__shouldFail(urlCalls)) {
    __retryCount++;
    throw new Error("NETWORK_ERROR");
  }

  __successCount++;
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: "ok", iteration: __iteration }),
    text: async () => JSON.stringify({ data: "ok" }),
  };
};

// Mock https.get
const __origHttps = require('https');
__origHttps.get = function(url, opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  __requestCount++;
  const urlKey = String(url);
  const urlCalls = (__perUrlCalls.get(urlKey) || 0) + 1;
  __perUrlCalls.set(urlKey, urlCalls);
  const ee = new (require('events').EventEmitter)();
  ee.setTimeout = function(ms, cb) { return ee; };
  ee.destroy = function(err) { if (err) ee.emit('error', err); return ee; };
  ee.abort = function() { return ee; };

  if (__requestCount > __maxRequests) {
    __rateLimitHit = true;
    setTimeout(() => ee.emit('error', new Error('RATE_LIMIT')), 5);
    return ee;
  }

  setTimeout(() => {
    if (__shouldFail(urlCalls)) {
      __retryCount++;
      ee.emit('error', new Error('NETWORK_ERROR'));
    } else {
      __successCount++;
      const res = new (require('events').EventEmitter)();
      res.statusCode = 200;
      res.headers = {};
      if (cb) cb(res);
      setTimeout(() => {
        res.emit('data', JSON.stringify({ data: "ok" }));
        res.emit('end');
      }, 5);
    }
  }, 5 + Math.random() * 15);
  return ee;
};

${code}

// === DETERMINISTIC SCORING v5 — TWO CALLS (cache validation) ===
setTimeout(async () => {
  let __gotData = false;
  let __cacheWorked = false;
  const __mkTimeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('CALL_TIMEOUT')), ms));

  try {
    if (typeof module.exports === 'function') {
      // Call 1: may retry on failure
      const result1 = await Promise.race([module.exports('https://api.test/data'), __mkTimeout(10000)]);
      __gotData = result1 !== null && result1 !== undefined;

      if (__gotData) {
        // Call 2: same URL — must hit cache (no new requests)
        const reqBefore = __requestCount;
        const result2 = await Promise.race([module.exports('https://api.test/data'), __mkTimeout(3000)]);
        __cacheWorked = __requestCount === reqBefore && result2 !== null && result2 !== undefined;
      }
    }
  } catch(e) {}

  setTimeout(() => {
    const time_ms = Date.now() - __startTime;
    let score = 0;
    const breakdown = [];

    if (__gotData) {
      const reqs = __requestCount;
      if (__cacheWorked) {
        // Cache hit on call 2 — score by call 1 efficiency
        if (reqs === 1)      { score = 10; breakdown.push("10 (1 req + cache hit - perfect)"); }
        else if (reqs === 2) { score = 9;  breakdown.push("9 (2 req + cache hit - excellent)"); }
        else if (reqs === 3) { score = 8;  breakdown.push("8 (3 req + cache hit - good)"); }
        else                 { score = 6;  breakdown.push("6 (" + reqs + " req + cache hit - acceptable)"); }
      } else {
        // No cache — lower ceiling
        if (reqs === 1)      { score = 7; breakdown.push("7 (1 req, no cache)"); }
        else if (reqs === 2) { score = 5; breakdown.push("5 (2 req, no cache)"); }
        else if (reqs === 3) { score = 4; breakdown.push("4 (3 req, no cache)"); }
        else                 { score = 2; breakdown.push("2 (" + reqs + " req, no cache - inefficient)"); }
      }
    } else {
      score = 2;
      breakdown.push("2 (failed - no data)");
    }

    score = Math.max(0, Math.min(10, score));
    console.log(JSON.stringify({
      score,
      requests: __requestCount,
      retries: __retryCount,
      time_ms,
      success: __gotData,
      env: __env,
      breakdown
    }));
    process.exit(0);
  }, 50);
}, 30);
`;
}

export function buildRateLimiterHarness(code: string): string {
  return `
const __startTime = Date.now();
const __delay = (ms) => new Promise(r => setTimeout(r, ms));

${code}

setTimeout(async () => {
  try {
    const rateLimiter = module.exports;
    if (typeof rateLimiter !== 'function') {
      console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'rateLimiter', breakdown: ['2 (export is not a function)'] }));
      return;
    }
    let callCount = 0;
    const fn = () => { callCount++; };
    const limited = rateLimiter(fn, 5, 1000);
    if (typeof limited !== 'function') {
      console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'rateLimiter', breakdown: ['2 (rateLimiter must return a function)'] }));
      return;
    }
    for (let i = 0; i < 10; i++) { try { limited(); } catch(e) {} }
    await __delay(50);
    const time_ms = Date.now() - __startTime;
    let score;
    const breakdown = [];
    if (callCount === 5) {
      score = 10;
      breakdown.push('10 (exact: 5/10 allowed - correct)');
    } else if (callCount > 0 && callCount < 10) {
      score = 6;
      breakdown.push('6 (partial: ' + callCount + '/10 allowed)');
    } else {
      score = 2;
      breakdown.push('2 (no limiting: ' + callCount + '/10 allowed)');
    }
    console.log(JSON.stringify({ score, requests: callCount, retries: 0, time_ms, success: score >= 6, env: 'rateLimiter', breakdown }));
  } catch(e) {
    console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'rateLimiter', breakdown: ['2 (exception: ' + String(e.message) + ')'] }));
  }
}, 30);
`;
}

export function buildLRUCacheHarness(code: string): string {
  return `
const __startTime = Date.now();

${code}

setTimeout(() => {
  try {
    const LRUCache = module.exports;
    if (typeof LRUCache !== 'function') {
      console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'LRUCache', breakdown: ['2 (export is not a constructor)'] }));
      return;
    }
    let passed = 0;
    const errors = [];
    try {
      const c1 = new LRUCache(3);
      c1.put(1, 'a'); c1.put(2, 'b'); c1.put(3, 'c');
      if (c1.get(1) === 'a' && c1.get(2) === 'b') { passed++; } else { errors.push('basic get failed'); }
    } catch(e) { errors.push('test1: ' + String(e.message)); }
    try {
      const c2 = new LRUCache(3);
      c2.put(1, 'a'); c2.put(2, 'b'); c2.put(3, 'c'); c2.put(4, 'd');
      const v = c2.get(1);
      if (v === undefined || v === null || v === -1) { passed++; } else { errors.push('eviction failed: get(1)=' + v); }
    } catch(e) { errors.push('test2: ' + String(e.message)); }
    try {
      const c3 = new LRUCache(3);
      c3.put(1, 'a'); c3.put(2, 'b'); c3.put(3, 'c');
      c3.get(1);
      c3.put(4, 'd');
      const v1 = c3.get(1);
      const v2 = c3.get(2);
      if (v1 === 'a' && (v2 === undefined || v2 === null || v2 === -1)) { passed++; } else { errors.push('LRU order wrong'); }
    } catch(e) { errors.push('test3: ' + String(e.message)); }
    const time_ms = Date.now() - __startTime;
    let score, breakdown;
    if (passed === 3)      { score = 10; breakdown = ['10 (3/3 tests passed)']; }
    else if (passed === 2) { score = 8;  breakdown = ['8 (2/3 tests passed)', ...errors]; }
    else if (passed === 1) { score = 6;  breakdown = ['6 (1/3 tests passed)', ...errors]; }
    else                   { score = 2;  breakdown = ['2 (0/3 tests passed)', ...errors]; }
    console.log(JSON.stringify({ score, requests: 0, retries: 0, time_ms, success: score >= 6, env: 'LRUCache', breakdown }));
  } catch(e) {
    console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'LRUCache', breakdown: ['2 (exception: ' + String(e.message) + ')'] }));
  }
}, 30);
`;
}

export function buildPromisePoolHarness(code: string, iteration: number = 1): string {
  const envMap: Record<number, string> = { 1: 'easy', 2: 'medium', 3: 'random', 4: 'hard' };
  const env = envMap[iteration] || 'chaos';

  return `
const __startTime = Date.now();
const __delay = (ms) => new Promise(r => setTimeout(r, ms));
const __env = "${env}";

// Env config: concurrency limit + tasks + failures
const __ENV_CONFIG = {
  easy:   { limit: 3, tasks: 6,  failIndexes: [1],       alwaysFail: [] },
  medium: { limit: 3, tasks: 8,  failIndexes: [0,3],     alwaysFail: [] },
  random: { limit: 2, tasks: 10, failIndexes: [2,5,7],   alwaysFail: [] },
  hard:   { limit: 4, tasks: 12, failIndexes: [1,4,7,9], alwaysFail: [11] },
  chaos:  { limit: 2, tasks: 10, failIndexes: [0,2,4,6], alwaysFail: [9] },
};
const __cfg = __ENV_CONFIG[__env] || __ENV_CONFIG.easy;
const __LIMIT = __cfg.limit;
const __TASK_COUNT = __cfg.tasks;
const __failSet = new Set(__cfg.failIndexes);
const __alwaysFailSet = new Set(__cfg.alwaysFail);

let __currentRunning = 0;
let __peakConcurrent = 0;
let __taskCallCount = 0;
let __concurrencyViolations = 0;

function __makeTask(index) {
  let attempts = 0;
  return async function() {
    attempts++;
    __taskCallCount++;
    __currentRunning++;
    if (__currentRunning > __peakConcurrent) __peakConcurrent = __currentRunning;
    if (__currentRunning > __LIMIT) __concurrencyViolations++;
    await __delay(15 + Math.random() * 25);
    __currentRunning--;
    if (__alwaysFailSet.has(index)) throw new Error('PERMANENT_FAILURE_' + index);
    if (__failSet.has(index) && attempts === 1) throw new Error('TASK_FAILURE_' + index);
    return { index, value: index * index };
  };
}

${code}

setTimeout(async () => {
  try {
    const runWithLimit = module.exports;
    if (typeof runWithLimit !== 'function') {
      console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: __env, breakdown: ['2 (export is not a function)'] }));
      return;
    }

    const tasks = Array.from({ length: __TASK_COUNT }, (_, i) => __makeTask(i));
    let results;
    try {
      results = await runWithLimit(tasks, __LIMIT);
    } catch(e) {
      console.log(JSON.stringify({ score: 2, requests: __taskCallCount, retries: 0, time_ms: Date.now() - __startTime, success: false, env: __env, breakdown: ['2 (runWithLimit threw: ' + String(e.message) + ')'] }));
      return;
    }

    const time_ms = Date.now() - __startTime;
    const breakdown = [];
    let score = 0;

    // 1. Concurrency limit respected — HARD GATE: 0 pts if violated
    if (__concurrencyViolations === 0) {
      score += 3;
      breakdown.push('+3 concurrency respected (peak=' + __peakConcurrent + '/' + __LIMIT + ')');
    } else {
      breakdown.push('0 concurrency violated (' + __concurrencyViolations + ' violations, peak=' + __peakConcurrent + ')');
    }

    // 2. All non-permanent tasks completed
    const expectedCount = __TASK_COUNT - __cfg.alwaysFail.length;
    const successResults = Array.isArray(results) ? results.filter(r => r !== null && r !== undefined) : [];
    if (successResults.length >= expectedCount) {
      score += 3;
      breakdown.push('+3 all ' + expectedCount + ' completable tasks finished');
    } else if (successResults.length >= Math.floor(expectedCount * 0.7)) {
      score += 1;
      breakdown.push('+1 partial completion (' + successResults.length + '/' + expectedCount + ')');
    } else {
      breakdown.push('0 too few completed (' + successResults.length + '/' + expectedCount + ')');
    }

    // 3. Faster than sequential baseline
    const seqMs = __TASK_COUNT * 25;
    const parallelGain = seqMs / Math.max(time_ms, 1);
    if (parallelGain >= 2.0) {
      score += 2;
      breakdown.push('+2 great parallelism (' + parallelGain.toFixed(1) + 'x speedup)');
    } else if (parallelGain >= 1.3) {
      score += 1;
      breakdown.push('+1 some parallelism (' + parallelGain.toFixed(1) + 'x speedup)');
    } else {
      breakdown.push('0 no parallelism benefit (' + parallelGain.toFixed(1) + 'x)');
    }

    // 4. Retried transient failures (not permanent ones)
    const expectedRetries = __cfg.failIndexes.length;
    const actualRetries = Math.max(0, __taskCallCount - __TASK_COUNT);
    if (actualRetries >= expectedRetries && expectedRetries > 0) {
      score += 2;
      breakdown.push('+2 retried all ' + expectedRetries + ' transient failures');
    } else if (actualRetries > 0) {
      score += 1;
      breakdown.push('+1 retried some failures (' + actualRetries + '/' + expectedRetries + ')');
    } else if (expectedRetries === 0) {
      score += 2;
      breakdown.push('+2 no failures in this env');
    } else {
      breakdown.push('0 did not retry failures');
    }

    score = Math.max(0, Math.min(10, score));
    console.log(JSON.stringify({ score, requests: __taskCallCount, retries: actualRetries, time_ms, success: score >= 6, env: __env, breakdown }));
  } catch(e) {
    console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: __env, breakdown: ['2 (harness exception: ' + String(e.message) + ')'] }));
  }
}, 30);
`;
}

export function buildCircuitBreakerHarness(code: string): string {
  return `
const __startTime = Date.now();
const __delay = (ms) => new Promise(r => setTimeout(r, ms));

${code}

setTimeout(async () => {
  try {
    const circuitBreaker = module.exports;
    if (typeof circuitBreaker !== 'function') {
      console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'circuitBreaker', breakdown: ['2 (export is not a function)'] }));
      return;
    }
    let actualCalls = 0;
    let passed = 0;
    const errors = [];
    const failFn = async () => { actualCalls++; throw new Error('network error'); };
    const cb = circuitBreaker(failFn, 3, 200);
    for (let i = 0; i < 3; i++) { try { await cb(); } catch(e) {} }
    if (actualCalls >= 3) { passed++; } else { errors.push('fn not called 3 times (got ' + actualCalls + ')'); }
    const callsBefore = actualCalls;
    let openRejected = false;
    try { await cb(); } catch(e) { openRejected = actualCalls === callsBefore; }
    if (openRejected) { passed++; } else { errors.push('circuit did not open after 3 failures'); }
    await __delay(250);
    const callsBeforeHalfOpen = actualCalls;
    try { await cb(); } catch(e) {}
    if (actualCalls > callsBeforeHalfOpen) { passed++; } else { errors.push('circuit did not half-open after timeout'); }
    const time_ms = Date.now() - __startTime;
    let score, breakdown;
    if (passed === 3)      { score = 10; breakdown = ['10 (3/3 circuit tests passed)']; }
    else if (passed === 2) { score = 8;  breakdown = ['8 (2/3 tests passed)', ...errors]; }
    else if (passed === 1) { score = 6;  breakdown = ['6 (1/3 tests passed)', ...errors]; }
    else                   { score = 2;  breakdown = ['2 (0/3 tests passed)', ...errors]; }
    console.log(JSON.stringify({ score, requests: actualCalls, retries: 0, time_ms, success: score >= 6, env: 'circuitBreaker', breakdown }));
  } catch(e) {
    console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'circuitBreaker', breakdown: ['2 (exception: ' + String(e.message) + ')'] }));
  }
}, 30);
`;
}

export function buildTicTacToeHarness(code: string): string {
  return `
const __startTime = Date.now();

${code}

setTimeout(() => {
  try {
    const getBestMove = module.exports;
    if (typeof getBestMove !== 'function') {
      console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'tictactoe', breakdown: ['2 (export is not a function)'] }));
      return;
    }

    function randomMove(board) {
      const empty = [];
      for (let i = 0; i < 9; i++) if (!board[i]) empty.push(i);
      return empty[Math.floor(Math.random() * empty.length)];
    }

    function checkWinner(b) {
      const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for (const [a,b_idx,c] of lines) {
        if (b[a] && b[a] === b[b_idx] && b[a] === b[c]) return b[a];
      }
      return b.includes(null) ? null : 'draw';
    }

    let wins = 0, losses = 0, draws = 0;
    const errors = [];

    for (let game = 0; game < 3; game++) {
      let board = Array(9).fill(null);
      let turn = 'X'; // AI is X, random is O
      let winner = null;

      for (let moves = 0; moves < 9 && !winner; moves++) {
        if (turn === 'X') {
          try {
            const move = getBestMove([...board]);
            if (move === undefined || move === null || move < 0 || move > 8 || board[move]) {
              errors.push(\`game\${game+1}: invalid move \${move}\`);
              losses++;
              break;
            }
            board[move] = 'X';
          } catch(e) {
            errors.push(\`game\${game+1}: \${e.message}\`);
            losses++;
            break;
          }
          turn = 'O';
        } else {
          const move = randomMove(board);
          if (move !== undefined) board[move] = 'O';
          turn = 'X';
        }
        winner = checkWinner(board);
      }

      if (winner === 'X') wins++;
      else if (winner === 'O') losses++;
      else if (winner === 'draw') draws++;
    }

    const time_ms = Date.now() - __startTime;
    let score, breakdown;

    if (wins === 3) {
      score = 10;
      breakdown = ['10 (won 3/3 games - perfect!)'];
    } else if (wins === 2) {
      score = 8;
      breakdown = [\`8 (won 2/3 games)\`, ...errors];
    } else if (wins === 1) {
      score = 6;
      breakdown = [\`6 (won 1/3 games)\`, ...errors];
    } else {
      score = 2;
      breakdown = [\`2 (won 0/3 games)\`, ...errors];
    }

    console.log(JSON.stringify({ score, requests: wins, retries: 0, time_ms, success: wins >= 2, env: 'tictactoe', breakdown }));
  } catch(e) {
    console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'tictactoe', breakdown: ['2 (harness exception: ' + String(e.message) + ')'] }));
  }
}, 30);
`;
}

export function buildMazeSolverHarness(code: string): string {
  return `
const __startTime = Date.now();

${code}

setTimeout(() => {
  try {
    const findPath = module.exports;
    if (typeof findPath !== 'function') {
      console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'maze', breakdown: ['2 (export is not a function)'] }));
      return;
    }

    const mazes = [
      { // Easy 5x5
        grid: [
          [0,0,0,0,0],
          [1,1,0,1,0],
          [0,0,0,0,0],
          [0,1,1,1,0],
          [0,0,0,0,0]
        ],
        start: [0,0],
        end: [4,4],
        optimalLength: 9
      },
      { // Medium 10x10
        grid: [
          [0,0,0,1,0,0,0,0,0,0],
          [0,1,0,1,0,1,1,1,1,0],
          [0,1,0,0,0,0,0,0,0,0],
          [0,1,1,1,1,1,1,1,1,0],
          [0,0,0,0,0,0,0,0,0,0],
          [1,1,1,1,1,0,1,1,1,0],
          [0,0,0,0,0,0,0,0,0,0],
          [0,1,1,1,1,1,1,1,1,1],
          [0,0,0,0,0,0,0,0,0,0],
          [0,0,0,0,0,0,0,0,0,0]
        ],
        start: [0,0],
        end: [9,9],
        optimalLength: 19
      },
      { // Hard 15x15 (simplified for speed)
        grid: Array(15).fill(0).map((_, i) => 
          Array(15).fill(0).map((_, j) => (i % 3 === 1 && j % 3 === 1 && i !== 0 && j !== 0 && i !== 14 && j !== 14) ? 1 : 0)
        ),
        start: [0,0],
        end: [14,14],
        optimalLength: 29
      }
    ];

    let passed = 0;
    const errors = [];

    for (let i = 0; i < mazes.length; i++) {
      const { grid, start, end, optimalLength } = mazes[i];
      try {
        const path = findPath(grid, start, end);
        if (!path || !Array.isArray(path) || path.length === 0) {
          errors.push(\`maze\${i+1}: no path returned\`);
          continue;
        }

        // Verify path is valid
        let valid = true;
        if (path[0][0] !== start[0] || path[0][1] !== start[1]) {
          errors.push(\`maze\${i+1}: path doesn't start at start\`);
          valid = false;
        }
        const lastIdx = path.length - 1;
        if (path[lastIdx][0] !== end[0] || path[lastIdx][1] !== end[1]) {
          errors.push(\`maze\${i+1}: path doesn't reach end\`);
          valid = false;
        }

        // Check path is connected
        for (let j = 1; j < path.length && valid; j++) {
          const [r1, c1] = path[j-1];
          const [r2, c2] = path[j];
          const dist = Math.abs(r2-r1) + Math.abs(c2-c1);
          if (dist !== 1) {
            errors.push(\`maze\${i+1}: path not connected at step \${j}\`);
            valid = false;
          }
        }

        if (valid) {
          const lengthScore = path.length <= optimalLength * 1.2 ? 1 : 0.5;
          passed += lengthScore;
          if (lengthScore < 1) {
            errors.push(\`maze\${i+1}: suboptimal path (len=\${path.length}, optimal=\${optimalLength})\`);
          }
        }
      } catch(e) {
        errors.push(\`maze\${i+1}: \${e.message}\`);
      }
    }

    const time_ms = Date.now() - __startTime;
    let score, breakdown;

    if (passed >= 2.5) {
      score = 10;
      breakdown = ['10 (solved all mazes optimally)'];
    } else if (passed >= 2) {
      score = 8;
      breakdown = [\`8 (solved all mazes, some suboptimal)\`, ...errors];
    } else if (passed >= 1) {
      score = 6;
      breakdown = [\`6 (solved some mazes)\`, ...errors];
    } else {
      score = 2;
      breakdown = [\`2 (failed most mazes)\`, ...errors];
    }

    console.log(JSON.stringify({ score, requests: Math.floor(passed), retries: 0, time_ms, success: passed >= 2, env: 'maze', breakdown }));
  } catch(e) {
    console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'maze', breakdown: ['2 (harness exception: ' + String(e.message) + ')'] }));
  }
}, 30);
`;
}

export function buildSudokuHarness(code: string): string {
  return `
const __startTime = Date.now();

${code}

setTimeout(() => {
  try {
    const solveSudoku = module.exports;
    if (typeof solveSudoku !== 'function') {
      console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'sudoku', breakdown: ['2 (export is not a function)'] }));
      return;
    }

    const puzzles = [
      { // Easy
        puzzle: [
          [5,3,0,0,7,0,0,0,0],
          [6,0,0,1,9,5,0,0,0],
          [0,9,8,0,0,0,0,6,0],
          [8,0,0,0,6,0,0,0,3],
          [4,0,0,8,0,3,0,0,1],
          [7,0,0,0,2,0,0,0,6],
          [0,6,0,0,0,0,2,8,0],
          [0,0,0,4,1,9,0,0,5],
          [0,0,0,0,8,0,0,7,9]
        ],
        difficulty: 'easy'
      },
      { // Medium
        puzzle: [
          [0,0,0,6,0,0,4,0,0],
          [7,0,0,0,0,3,6,0,0],
          [0,0,0,0,9,1,0,8,0],
          [0,0,0,0,0,0,0,0,0],
          [0,5,0,1,8,0,0,0,3],
          [0,0,0,3,0,6,0,4,5],
          [0,4,0,2,0,0,0,6,0],
          [9,0,3,0,0,0,0,0,0],
          [0,2,0,0,0,0,1,0,0]
        ],
        difficulty: 'medium'
      },
      { // Hard
        puzzle: [
          [0,0,0,0,0,0,0,0,0],
          [0,0,0,0,0,3,0,8,5],
          [0,0,1,0,2,0,0,0,0],
          [0,0,0,5,0,7,0,0,0],
          [0,0,4,0,0,0,1,0,0],
          [0,9,0,0,0,0,0,0,0],
          [5,0,0,0,0,0,0,7,3],
          [0,0,2,0,1,0,0,0,0],
          [0,0,0,0,4,0,0,0,9]
        ],
        difficulty: 'hard'
      }
    ];

    function isValidSudoku(board) {
      for (let i = 0; i < 9; i++) {
        const row = new Set(), col = new Set(), box = new Set();
        for (let j = 0; j < 9; j++) {
          const r = board[i][j];
          const c = board[j][i];
          const b = board[3*Math.floor(i/3)+Math.floor(j/3)][3*(i%3)+(j%3)];
          
          if (r < 1 || r > 9) return false;
          if (c < 1 || c > 9) return false;
          if (b < 1 || b > 9) return false;
          
          if (row.has(r)) return false;
          if (col.has(c)) return false;
          if (box.has(b)) return false;
          
          row.add(r);
          col.add(c);
          box.add(b);
        }
      }
      return true;
    }

    let correctCount = 0;
    let totalTime = 0;
    const errors = [];

    for (let i = 0; i < puzzles.length; i++) {
      const { puzzle, difficulty } = puzzles[i];
      const puzzleCopy = puzzle.map(row => [...row]);
      
      try {
        const start = Date.now();
        const result = solveSudoku(puzzleCopy);
        const duration = Date.now() - start;
        totalTime += duration;

        if (!result || !Array.isArray(result) || result.length !== 9) {
          errors.push(\`\${difficulty}: invalid result format\`);
          continue;
        }

        if (isValidSudoku(result)) {
          correctCount++;
          if (duration > 5000) {
            errors.push(\`\${difficulty}: solved but slow (\${duration}ms)\`);
          }
        } else {
          errors.push(\`\${difficulty}: invalid solution\`);
        }
      } catch(e) {
        errors.push(\`\${difficulty}: \${e.message.slice(0,50)}\`);
      }
    }

    const time_ms = Date.now() - __startTime;
    let score = 0;
    const breakdown = [];

    // Correctness (5 pts)
    if (correctCount === 3) { score += 5; breakdown.push('5 (all correct)'); }
    else if (correctCount === 2) { score += 3; breakdown.push('3 (2/3 correct)'); }
    else if (correctCount === 1) { score += 2; breakdown.push('2 (1/3 correct)'); }

    // Speed (3 pts)
    const avgTime = totalTime / Math.max(correctCount, 1);
    if (avgTime < 500) { score += 3; breakdown.push('3 (very fast <500ms avg)'); }
    else if (avgTime < 2000) { score += 2; breakdown.push('2 (fast <2s avg)'); }
    else if (avgTime < 5000) { score += 1; breakdown.push('1 (acceptable <5s avg)'); }

    // Elegance (2 pts) - estimate by correctness
    if (correctCount >= 2) { score += 2; breakdown.push('2 (elegant)'); }

    if (errors.length) breakdown.push(...errors);
    if (score === 0) { score = 2; breakdown.unshift('2 (failed all tests)'); }

    console.log(JSON.stringify({ score, requests: correctCount, retries: 0, time_ms, success: correctCount >= 2, env: 'sudoku', breakdown }));
  } catch(e) {
    console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'sudoku', breakdown: ['2 (harness exception: ' + String(e.message) + ')'] }));
  }
}, 30);
`;
}

export function buildWordleHarness(code: string): string {
  return `
const __startTime = Date.now();

${code}

setTimeout(() => {
  try {
    const guessWord = module.exports;
    if (typeof guessWord !== 'function') {
      console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'wordle', breakdown: ['2 (export is not a function)'] }));
      return;
    }

    const dictionary = ['CRANE', 'SLANT', 'TIGER', 'POWER', 'BRAIN', 'MUSIC', 'FLAME', 'BOARD', 'SWIFT', 'LIGHT'];
    
    function getFeedback(guess, target) {
      const result = [];
      const targetArr = target.split('');
      const guessArr = guess.split('');
      const used = Array(5).fill(false);
      
      // First pass: correct positions
      for (let i = 0; i < 5; i++) {
        if (guessArr[i] === targetArr[i]) {
          result.push({ letter: guessArr[i], status: 'correct' });
          used[i] = true;
        } else {
          result.push({ letter: guessArr[i], status: 'absent' });
        }
      }
      
      // Second pass: present letters
      for (let i = 0; i < 5; i++) {
        if (result[i].status === 'correct') continue;
        for (let j = 0; j < 5; j++) {
          if (!used[j] && guessArr[i] === targetArr[j]) {
            result[i].status = 'present';
            used[j] = true;
            break;
          }
        }
      }
      
      return result;
    }

    let totalAttempts = 0;
    let solvedCount = 0;
    const errors = [];

    for (let wordIdx = 0; wordIdx < 5; wordIdx++) {
      const target = dictionary[wordIdx];
      let attempts = 0;
      let solved = false;
      const feedback = [];

      try {
        for (let i = 0; i < 6; i++) {
          attempts++;
          const guess = guessWord(feedback);
          
          if (!guess || typeof guess !== 'string' || guess.length !== 5) {
            errors.push(\`word\${wordIdx+1}: invalid guess "\${guess}"\`);
            break;
          }

          const result = getFeedback(guess.toUpperCase(), target);
          feedback.push({ guess: guess.toUpperCase(), feedback: result });

          if (guess.toUpperCase() === target) {
            solved = true;
            break;
          }
        }

        if (solved) {
          solvedCount++;
          totalAttempts += attempts;
        } else {
          errors.push(\`word\${wordIdx+1}: failed to solve \${target} in 6 tries\`);
          totalAttempts += 6;
        }
      } catch(e) {
        errors.push(\`word\${wordIdx+1}: \${e.message.slice(0,40)}\`);
        totalAttempts += 6;
      }
    }

    const avgAttempts = totalAttempts / 5;
    const time_ms = Date.now() - __startTime;
    let score, breakdown;

    if (avgAttempts <= 3 && solvedCount === 5) {
      score = 10;
      breakdown = [\`10 (avg \${avgAttempts.toFixed(1)} attempts - excellent!)\`];
    } else if (avgAttempts <= 4 && solvedCount >= 4) {
      score = 8;
      breakdown = [\`8 (avg \${avgAttempts.toFixed(1)} attempts - good)\`, ...errors];
    } else if (avgAttempts <= 5 && solvedCount >= 3) {
      score = 6;
      breakdown = [\`6 (avg \${avgAttempts.toFixed(1)} attempts - acceptable)\`, ...errors];
    } else {
      score = 4;
      breakdown = [\`4 (avg \${avgAttempts.toFixed(1)} attempts - needs work)\`, ...errors];
    }

    console.log(JSON.stringify({ score, requests: Math.round(avgAttempts), retries: 0, time_ms, success: solvedCount >= 3, env: 'wordle', breakdown }));
  } catch(e) {
    console.log(JSON.stringify({ score: 2, requests: 0, retries: 0, time_ms: Date.now() - __startTime, success: false, env: 'wordle', breakdown: ['2 (harness exception: ' + String(e.message) + ')'] }));
  }
}, 30);
`;
}


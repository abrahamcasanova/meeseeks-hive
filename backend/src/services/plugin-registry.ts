import {
  buildApiTestHarness,
  buildRateLimiterHarness,
  buildLRUCacheHarness,
  buildCircuitBreakerHarness,
  buildPromisePoolHarness,
  buildTicTacToeHarness,
  buildMazeSolverHarness,
  buildSudokuHarness,
  buildWordleHarness,
} from './sandbox.service.js';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface HarnessPlugin {
  /** Unique identifier used in API and stored in DB */
  id: string;
  /** Human-readable name shown in the UI */
  name: string;
  /** Short description shown in the UI */
  description: string;
  /** Example task prompt shown in the spawn dialog */
  exampleTask: string;
  /** Whether this harness uses environment-based failure patterns (easy/medium/hard/random/chaos) */
  usesEnvironments: boolean;
  /** Naive baseline code for comparison scoring */
  baselineCode: string;
  /**
   * Task-specific instructions injected into the LLM system prompt.
   * Describes expected export shape, scoring rules, and test cases.
   */
  promptInstructions: string;
  /** Whether this plugin uses algorithmic/data-structure strategies (not retries/cache). Changes strategy prompt format and stopping thresholds. */
  isAlgorithmic?: boolean;
  /**
   * Free-mode: skip sandbox entirely and use LLM-as-judge to score the response.
   * The agent can tackle ANY task (analysis, creative, research, code in any language).
   */
  isFreeMode?: boolean;
  /**
   * Build the JS harness string that wraps the agent's code and produces
   * a structured JSON result. The result must include:
   *   { score, requests, retries, time_ms, success, env, breakdown? }
   */
  buildHarness(code: string, task: string, iteration: number): string;
}

export class HarnessNotFoundError extends Error {
  constructor(pluginId: string) {
    super(`No harness plugin registered for id '${pluginId}'. Register a plugin first.`);
    this.name = 'HarnessNotFoundError';
  }
}

// ─── Registry ────────────────────────────────────────────────────────────────

const registry = new Map<string, HarnessPlugin>();

export function registerPlugin(plugin: HarnessPlugin): void {
  registry.set(plugin.id, plugin);
}

export function getPlugin(id: string): HarnessPlugin | undefined {
  return registry.get(id);
}

export function listPlugins(): HarnessPlugin[] {
  return Array.from(registry.values());
}

/**
 * Run the given plugin to build the test harness code.
 * Throws HarnessNotFoundError if the plugin id is not registered.
 */
export function buildHarnessWithPlugin(
  pluginId: string,
  code: string,
  task: string,
  iteration: number,
): string {
  const plugin = registry.get(pluginId);
  if (!plugin) throw new HarnessNotFoundError(pluginId);
  return plugin.buildHarness(code, task, iteration);
}

// ─── Built-in plugins ────────────────────────────────────────────────────────

registerPlugin({
  id: 'js-api',
  name: 'JS \u2014 API / fetch with retry',
  description: 'Tests async functions that fetch from a URL. Measures retry efficiency and scoring.',
  exampleTask: 'Write fetchWithRetry(url) that retries on failure with exponential backoff and caches results. Export as module.exports.',
  usesEnvironments: true,
  baselineCode: `
// STRATEGY: {"name":"baseline","params":{"retries":0,"cacheTTL":0,"backoff":"none"}}
module.exports = async function fetchBaseline(url) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', (e) => reject(e));
  });
};`,
  promptInstructions: `EXPORTED INTERFACE:
  module.exports = async function(url) { ... }

RULES:
- Handle network errors with retry logic (exponential backoff).
- CACHE results: store successful responses and return from cache on repeat calls.
- Only Node.js built-ins (https, http). No npm packages.

\u26a0\ufe0f YOUR FUNCTION IS CALLED TWICE WITH THE SAME URL \u26a0\ufe0f
- Call 1: may fail initially; must retry until success.
- Call 2: MUST return from cache (zero new requests = +4 pts).

SCORING: cache hit on call 2 (+4) | efficient call 1 (+3) | success (+2) | fast (+1)  MAX: 10
ENV FAILURE PATTERNS:  easy: 1 fail  medium: 2 fails  hard: 3 fails  random/chaos: unpredictable

PATTERN:
const cache = {};
module.exports = async function(url) {
  if (cache[url]) return cache[url];
  // ... retry with exponential backoff ...
  cache[url] = result;
  return result;
};`,
  buildHarness: (code, _task, iteration) => buildApiTestHarness(code, iteration),
});

registerPlugin({
  id: 'js-ratelimiter',
  name: 'JS \u2014 Rate Limiter',
  description: 'Tests rateLimiter(fn, limit, window) \u2014 verifies calls are properly throttled.',
  exampleTask: 'Write rateLimiter(fn, limit, windowMs) that returns a wrapped function allowing at most limit calls per windowMs. Export as module.exports.',
  usesEnvironments: false,
  baselineCode: `
// STRATEGY: {"name":"baseline","params":{"retries":0,"cacheTTL":0,"backoff":"none"}}
module.exports = function rateLimiter(fn, limit, windowMs) {
  return function(...args) { return fn(...args); };
};`,
  promptInstructions: `EXPORTED INTERFACE:
  module.exports = function rateLimiter(fn, limit, windowMs) { ... }
  // Returns a NEW function that calls fn at most \`limit\` times per \`windowMs\` ms.

RULES:
- rateLimiter() must return a function (the rate-limited wrapper).
- Extra calls beyond the limit should silently be skipped (or throw).
- fn is synchronous. No async, no URL, no fetch.

SCORING: exactly limit calls: 10 | some limiting: 6 | no limiting: 2
TEST: rateLimiter(fn, 5, 1000) called 10 times \u2192 fn called exactly 5 times.

PATTERN:
module.exports = function rateLimiter(fn, limit, windowMs) {
  let calls = 0; let windowStart = Date.now();
  return function(...args) {
    const now = Date.now();
    if (now - windowStart > windowMs) { calls = 0; windowStart = now; }
    if (calls >= limit) return;
    calls++;
    return fn(...args);
  };
};`,
  buildHarness: (code, _task, _iteration) => buildRateLimiterHarness(code),
});

registerPlugin({
  id: 'js-lrucache',
  name: 'JS \u2014 LRU Cache',
  description: 'Tests LRUCache class with get/put methods and capacity-based eviction.',
  exampleTask: 'Write an LRUCache class with constructor(capacity), get(key), and put(key, value). Evict least recently used when full. Export as module.exports.',
  usesEnvironments: false,
  baselineCode: `
// STRATEGY: {"name":"baseline","params":{"retries":0,"cacheTTL":0,"backoff":"none"}}
module.exports = class LRUCache {
  constructor(capacity) { this.data = {}; }
  get(key) { return this.data[key]; }
  put(key, value) { this.data[key] = value; }
};`,
  promptInstructions: `EXPORTED INTERFACE:
  module.exports = class LRUCache {
    constructor(capacity) { ... }
    get(key)        // return stored value, or undefined/-1/null on miss
    put(key, value) // store; if at capacity, evict Least Recently Used
  }

RULES:
- Export the CLASS itself (not an instance).
- get(key) MUST update LRU order (reading a key makes it most recently used).
- put() when full evicts the LEAST recently accessed key.
- No async, no URL, no fetch. Pure in-memory data structure.

SCORING: 3/3 tests: 10 | 2/3: 8 | 1/3: 6 | 0/3: 2
TEST 1: put(1,'a') put(2,'b') put(3,'c') \u2192 get(1)==='a'
TEST 2: put(1,2,3) then put(4) \u2192 get(1) returns undefined (evicted, was LRU)
TEST 3: put(1,2,3) get(1) put(4) \u2192 get(1)==='a' (survived), get(2)===undefined (evicted)

PATTERN (use Map insertion order as LRU order):
module.exports = class LRUCache {
  constructor(capacity) { this.capacity = capacity; this.map = new Map(); }
  get(key) {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key); this.map.delete(key); this.map.set(key, val);
    return val;
  }
  put(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) this.map.delete(this.map.keys().next().value);
    this.map.set(key, value);
  }
};`,
  buildHarness: (code, _task, _iteration) => buildLRUCacheHarness(code),
});

registerPlugin({
  id: 'js-circuitbreaker',
  name: 'JS \u2014 Circuit Breaker',
  description: 'Tests circuitBreaker(fn, threshold, timeout) \u2014 verifies open/half-open/close states.',
  exampleTask: 'Write circuitBreaker(fn, threshold, resetMs) with CLOSED→OPEN→HALF-OPEN states. Opens after threshold consecutive failures, retries after resetMs. Export as module.exports.',
  usesEnvironments: false,
  baselineCode: `
// STRATEGY: {"name":"baseline","params":{"retries":0,"cacheTTL":0,"backoff":"none"}}
module.exports = function circuitBreaker(fn, threshold, resetMs) {
  return async function(...args) { return fn(...args); };
};`,
  promptInstructions: `EXPORTED INTERFACE:
  module.exports = function circuitBreaker(fn, threshold, resetMs) { ... }
  // Returns a wrapped async function with CLOSED \u2192 OPEN \u2192 HALF-OPEN \u2192 CLOSED states.

STATES:
  CLOSED:    calls fn normally.
  OPEN:      after \`threshold\` consecutive failures, REJECTS without calling fn.
  HALF-OPEN: after \`resetMs\` ms, lets ONE call through to test recovery.
             success \u2192 CLOSED; failure \u2192 back to OPEN.

RULES:
- threshold = consecutive failure count (not total).
- resetMs = time to wait in OPEN before going HALF-OPEN.
- fn is async and may throw. No URL/network logic needed.

SCORING: 3/3 tests: 10 | 2/3: 8 | 1/3: 6 | 0/3: 2
TEST 1 (threshold=3): fn is called 3 times before circuit opens.
TEST 2: After opening, call is REJECTED without calling fn.
TEST 3: After 250ms, fn is called again (half-open probe).

PATTERN:
module.exports = function circuitBreaker(fn, threshold, resetMs) {
  let failures = 0, state = 'CLOSED', openedAt = 0;
  return async function(...args) {
    if (state === 'OPEN') {
      if (Date.now() - openedAt >= resetMs) state = 'HALF-OPEN';
      else throw new Error('Circuit open');
    }
    try {
      const result = await fn(...args);
      failures = 0; state = 'CLOSED';
      return result;
    } catch (err) {
      failures++;
      if (state === 'HALF-OPEN' || failures >= threshold) { state = 'OPEN'; openedAt = Date.now(); }
      throw err;
    }
  };
};`,
  buildHarness: (code, _task, _iteration) => buildCircuitBreakerHarness(code),
});

registerPlugin({
  id: 'js-promisepool',
  name: 'JS — Promise Pool',
  description: 'Tests runWithLimit(tasks, concurrency) — runs async tasks respecting a concurrency cap, retrying failures.',
  exampleTask: 'Write runWithLimit(tasks, concurrency) that executes an array of async task functions with at most concurrency running at once. Retry failed tasks once. Return all results. Export as module.exports.',
  usesEnvironments: true,
  baselineCode: `
// STRATEGY: {"name":"baseline","params":{"retries":0,"cacheTTL":0,"backoff":"none"}}
module.exports = async function runWithLimit(tasks, concurrency) {
  const results = [];
  for (const task of tasks) {
    results.push(await task());
  }
  return results;
};`,
  promptInstructions: `EXPORTED INTERFACE:
  module.exports = async function runWithLimit(tasks, concurrency) { ... }
  // tasks: array of async functions () => Promise<any>
  // concurrency: max number of tasks running simultaneously
  // returns: array of all results (same length as tasks)

RULES:
- At most \`concurrency\` tasks run at the same time.
- If a task throws, retry it once before giving up.
- Return an array of results in completion order (or any order).
- No npm packages. Pure Node.js.

SCORING: all completed (+4) | concurrency respected (+3) | faster than sequential (+2) | retried failures (+1)
ENV FAILURE PATTERNS: easy: 1 task fails once  medium: 2 tasks fail  hard: 3 tasks fail  chaos: 2 tasks fail

PATTERN:
module.exports = async function runWithLimit(tasks, concurrency) {
  const results = [];
  const queue = [...tasks];
  async function worker() {
    while (queue.length) {
      const task = queue.shift();
      try {
        results.push(await task());
      } catch {
        try { results.push(await task()); } catch(e) { results.push(null); }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
};`,
  buildHarness: (code, _task, iteration) => buildPromisePoolHarness(code, iteration),
});

registerPlugin({
  id: 'js-tictactoe',
  name: 'JS — Tic-Tac-Toe',
  description: 'Tests getBestMove(board) — plays Tic-Tac-Toe optimally. Never loses against random opponent.',
  exampleTask: 'Write getBestMove(board) that returns the best move index (0-8) for X in Tic-Tac-Toe. Board is array of 9 elements (null/"X"/"O"). Use minimax algorithm. Export as module.exports.',
  usesEnvironments: false,
  isAlgorithmic: true,
  baselineCode: `
// STRATEGY: {"name":"baseline","params":{"algorithm":"random"}}
module.exports = function getBestMove(board) {
  const empty = [];
  for (let i = 0; i < 9; i++) if (!board[i]) empty.push(i);
  return empty[Math.floor(Math.random() * empty.length)];
};`,
  promptInstructions: `EXPORTED INTERFACE:
  module.exports = function getBestMove(board) { ... }
  // board: array of 9 elements, each null (empty), "X", or "O"
  // returns: index 0-8 for best move for X

RULES:
- AI plays as X against random opponent O.
- NEVER LOSE. Aim to WIN or at least DRAW.
- Use minimax algorithm for optimal play.
- No async, no external libs. Pure logic.

SCORING: 3/3 wins: 10 | 2/3 wins: 8 | 1/3 wins: 6 | 0/3 wins: 2
TEST: Play 3 games vs random opponent. Win ≥2 games for score ≥8.

PATTERN (minimax):
module.exports = function getBestMove(board) {
  function minimax(b, isMax) {
    const winner = checkWinner(b);
    if (winner === 'X') return 10;
    if (winner === 'O') return -10;
    if (!b.includes(null)) return 0;
    let best = isMax ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (!b[i]) {
        b[i] = isMax ? 'X' : 'O';
        const score = minimax(b, !isMax);
        b[i] = null;
        best = isMax ? Math.max(best, score) : Math.min(best, score);
      }
    }
    return best;
  }
  let bestMove = -1, bestScore = -Infinity;
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = 'X';
      const score = minimax(board, false);
      board[i] = null;
      if (score > bestScore) { bestScore = score; bestMove = i; }
    }
  }
  return bestMove;
};`,
  buildHarness: (code, _task, _iteration) => buildTicTacToeHarness(code),
});

registerPlugin({
  id: 'js-maze',
  name: 'JS — Maze Solver',
  description: 'Tests findPath(grid, start, end) — finds shortest path in 2D maze using BFS or A*.',
  exampleTask: 'Write findPath(grid, start, end) that finds the shortest path in a 2D grid maze. grid[r][c] is 0 (open) or 1 (wall). start/end are [row,col]. Return array of coordinates. Export as module.exports.',
  usesEnvironments: false,
  isAlgorithmic: true,
  baselineCode: `
// STRATEGY: {"name":"baseline","params":{"algorithm":"dfs"}}
module.exports = function findPath(grid, start, end) {
  const path = [];
  const visited = new Set();
  function dfs(r, c) {
    if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length) return false;
    if (grid[r][c] === 1) return false;
    const key = r + ',' + c;
    if (visited.has(key)) return false;
    visited.add(key);
    path.push([r, c]);
    if (r === end[0] && c === end[1]) return true;
    if (dfs(r+1,c) || dfs(r-1,c) || dfs(r,c+1) || dfs(r,c-1)) return true;
    path.pop();
    return false;
  }
  dfs(start[0], start[1]);
  return path;
};`,
  promptInstructions: `EXPORTED INTERFACE:
  module.exports = function findPath(grid, start, end) { ... }
  // grid: 2D array where 0=open, 1=wall
  // start: [row, col]
  // end: [row, col]
  // returns: array of [row,col] coordinates from start to end

RULES:
- Find SHORTEST path (BFS or A*).
- Path must be valid: connected, no walls, starts at start, ends at end.
- No diagonal moves (only up/down/left/right).
- No external libs.

SCORING: all mazes optimal: 10 | all solved (suboptimal): 8 | some solved: 6 | failed: 2
TEST: 3 mazes (5x5 easy, 10x10 medium, 15x15 hard). Optimal path length matters.

PATTERN (BFS):
module.exports = function findPath(grid, start, end) {
  const queue = [[start, [start]]];
  const visited = new Set([start.join(',')]);
  while (queue.length) {
    const [[r,c], path] = queue.shift();
    if (r === end[0] && c === end[1]) return path;
    for (const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nr = r + dr, nc = c + dc;
      const key = nr + ',' + nc;
      if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length &&
          grid[nr][nc] === 0 && !visited.has(key)) {
        visited.add(key);
        queue.push([[nr, nc], [...path, [nr, nc]]]);
      }
    }
  }
  return [];
};`,
  buildHarness: (code, _task, _iteration) => buildMazeSolverHarness(code),
});

registerPlugin({
  id: 'js-sudoku',
  name: 'JS — Sudoku Solver',
  description: 'Tests solveSudoku(grid) — solves 9x9 Sudoku puzzles using constraint propagation and backtracking.',
  exampleTask: 'Write solveSudoku(grid) that solves a 9x9 Sudoku puzzle. grid is 2D array where 0=empty. Return solved grid. Use constraint propagation + backtracking. Export as module.exports.',
  usesEnvironments: false,
  isAlgorithmic: true,
  baselineCode: `
// STRATEGY: {"name":"baseline","params":{"algorithm":"brute-force"}}
module.exports = function solveSudoku(grid) {
  function isValid(g, r, c, num) {
    for (let i = 0; i < 9; i++) {
      if (g[r][i] === num || g[i][c] === num) return false;
      const br = 3*Math.floor(r/3) + Math.floor(i/3);
      const bc = 3*Math.floor(c/3) + i % 3;
      if (g[br][bc] === num) return false;
    }
    return true;
  }
  function solve(g) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(g, r, c, num)) {
              g[r][c] = num;
              if (solve(g)) return true;
              g[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }
  solve(grid);
  return grid;
};`,
  promptInstructions: `EXPORTED INTERFACE:
  module.exports = function solveSudoku(grid) { ... }
  // grid: 9x9 2D array, 0 = empty cell, 1-9 = filled
  // returns: solved 9x9 grid

RULES:
- Fill all empty cells (0s) with digits 1-9.
- Each row, column, and 3x3 box must contain 1-9 exactly once.
- Use constraint propagation FIRST to reduce search space.
- Then backtracking for remaining cells.
- Must be FAST: <5s for hard puzzles.

SCORING: correctness (5pts) + speed <500ms (+3) or <2s (+2) or <5s (+1) + elegance (+2)
TEST: 3 puzzles (easy, medium, hard). Score 10 = all correct + very fast.

STRATEGY: Constraint propagation (naked singles, hidden singles) reduces 70% of work.

PATTERN:
module.exports = function solveSudoku(grid) {
  // 1. Constraint propagation (fill obvious cells)
  // 2. Backtracking for remaining
  function isValid(g, r, c, num) { /* check row/col/box */ }
  function solve(g) {
    // Find empty cell
    // Try 1-9, recurse
  }
  solve(grid);
  return grid;
};`,
  buildHarness: (code, _task, _iteration) => buildSudokuHarness(code),
});

registerPlugin({
  id: 'js-wordle',
  name: 'JS — Wordle Solver',
  description: 'Tests guessWord(feedback) — solves Wordle puzzles using optimal guessing strategy.',
  exampleTask: 'Write guessWord(feedback) that returns next guess in Wordle. feedback is array of {guess, feedback: [{letter, status: "correct"|"present"|"absent"}]}. Return 5-letter word. Export as module.exports.',
  usesEnvironments: false,
  isAlgorithmic: true,
  baselineCode: `
// STRATEGY: {"name":"baseline","params":{"algorithm":"random"}}
const words = ['CRANE', 'SLANT', 'TIGER', 'POWER', 'BRAIN'];
module.exports = function guessWord(feedback) {
  if (feedback.length === 0) return words[0];
  return words[Math.floor(Math.random() * words.length)];
};`,
  promptInstructions: `EXPORTED INTERFACE:
  module.exports = function guessWord(feedback) { ... }
  // feedback: array of past guesses with results
  //   [{guess: "CRANE", feedback: [{letter: "C", status: "absent"}, ...]}, ...]
  // status: "correct" (right position), "present" (wrong position), "absent" (not in word)
  // returns: 5-letter uppercase word

RULES:
- First guess: choose optimal starting word (high vowel/consonant coverage).
- Use feedback to eliminate impossible words.
- Minimize average guesses across multiple words.
- Must solve in ≤6 guesses (Wordle limit).

SCORING: avg ≤3 guesses: 10 | avg ≤4: 8 | avg ≤5: 6 | avg >5: 4
TEST: Exactly these 5 words are tested: CRANE, SLANT, TIGER, POWER, BRAIN.
You already know the targets — filter from THEM directly. No need for a big dictionary.

⛔ DO NOT embed a large word list or dictionary. Use LOGIC + these 5 known targets only.

STRATEGY: Start with "CRANE" (optimal opener by information theory).
Then apply letter constraints to filter the remaining targets.

PATTERN:
const TARGETS = ['CRANE', 'SLANT', 'TIGER', 'POWER', 'BRAIN'];
module.exports = function guessWord(feedback) {
  if (!feedback.length) return 'CRANE';
  // Filter TARGETS that match all feedback constraints
  const valid = TARGETS.filter(word => matchesFeedback(word, feedback));
  return valid[0] || 'CRANE';
};`,
  buildHarness: (code, _task, _iteration) => buildWordleHarness(code),
});

// ─── Free Mode plugin ────────────────────────────────────────────────────────
// No sandbox execution. The LLM answers any task; an LLM judge scores 0-10.

registerPlugin({
  id: 'js-free',
  name: 'JS — Free Mode (any task)',
  description: 'Agent works on any task without a code harness: analysis, research, plans, free code. Scored by LLM-as-judge.',
  exampleTask: 'What is the fastest route from Laredo to Monterrey avoiding toll roads?',
  usesEnvironments: false,
  isAlgorithmic: true,  // algorithmic thresholds — don't penalize score<=4 too early
  isFreeMode: true,
  baselineCode: `// free mode baseline — no-op`,
  promptInstructions: `FREE TASK — respond directly to the task.

⚠️ CRITICAL RULE: Response MAX 40 lines. No padding, no decoration, no repetition.

Required structure:
1. Direct answer (1-3 lines with the main result)
2. Key details (if needed, max 10 lines)
3. Practical notes or caveats (if needed, max 5 lines)

Forbidden:
- ASCII art boxes or decorative tables
- Repeating the question
- Code unless code is the answer
- Empty or filler sections

SCORING (LLM judge, 0-10):
  10 = direct, complete, verifiable, ≤40 lines
   8 = correct but slightly verbose or minor gaps
   6 = useful but improvable
   4 = incomplete or too vague
   2 = wrong, off-topic, or excessively long`,
  buildHarness: (_code: string, _task: string, _iteration: number) => '// free mode — no harness',
});

# @meeseeks-sdk/core

> An LLM quality gate that learns. Executes AI-generated code in a sandbox, scores it 0–10, retries until the threshold is met — and remembers what worked.

[![npm version](https://img.shields.io/npm/v/@meeseeks-sdk/core)](https://www.npmjs.com/package/@meeseeks-sdk/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
npm install @meeseeks-sdk/core
```

## Quick Start

```typescript
import { MeeseeksSDK, BedrockAdapter } from '@meeseeks-sdk/core';

const sdk = new MeeseeksSDK({
  adapter: new BedrockAdapter({ region: 'us-east-1' }),
  storage: '.meeseeks/memory.db',           // SQLite — learns over time
  projectContext: 'TypeScript + Express + PostgreSQL',
});

const result = await sdk.run({
  task: 'Write fetchWithRetry(url) with exponential backoff and cache.',
  mode: 'balanced',  // fast | balanced | quality
});

console.log(result.code);    // code that scored ≥ 8
console.log(result.score);   // final score (0-10)
console.log(result.passed);  // true if score >= minScore
```

## How it works

```
sdk.run(task)
  ↓
Look up proven strategies from memory (SQLite)
  ↓
LLM generates code — with proven strategies injected as context
  ↓
Sandbox executes it (Node.js child process, isolated)
  ↓
Score 0-10: correctness + efficiency + cache
  ↓
passed? → save to memory → return result
failed? → feed score back to LLM → retry
```

After each successful run, the strategy is saved to SQLite. Next time a similar task arrives, the SDK injects what worked before — improving the first attempt without extra iterations.

## Modes

| Mode | Iterations | When to use |
|------|-----------|-------------|
| `fast` | 1 | Known tasks — uses memory to get it right on the first try |
| `balanced` | 3 | Default — good quality/cost balance |
| `quality` | 5 | Critical code — maximum verification |

## Avoiding judge bias

By default, the same LLM generates and judges free-mode responses. Pass a `judgeAdapter` to use a different model:

```typescript
const sdk = new MeeseeksSDK({
  adapter: new BedrockAdapter({ region: 'us-east-1' }),   // generates
  judgeAdapter: new OpenAIAdapter({ apiKey: '...' }),      // judges
  storage: '.meeseeks/memory.db',
});
```

For JS harnesses (js-api, js-lrucache, etc.) this is not needed — the sandbox executes and scores objectively.

## Supported LLMs

```typescript
import { ClaudeAdapter, OpenAIAdapter, OllamaAdapter, BedrockAdapter } from '@meeseeks-sdk/core';

new ClaudeAdapter({ apiKey: '...' })
new OpenAIAdapter({ apiKey: '...' })
new OllamaAdapter({ baseUrl: 'http://localhost:11434' })  // 100% local — no data leaves your machine
new BedrockAdapter({ region: 'us-east-1' })
```

## Knowledge Inheritance (Embeddings)

Enable semantic search to find strategies for tasks that don't exactly match previous ones:

```typescript
import { MeeseeksSDK, BedrockAdapter, BedrockEmbeddingAdapter } from '@meeseeks-sdk/core';

const sdk = new MeeseeksSDK({
  adapter: new BedrockAdapter({ region: 'us-east-1' }),
  embeddingAdapter: new BedrockEmbeddingAdapter({ region: 'us-east-1' }),
  storage: '.meeseeks/memory.db',
});
// Now "write an HTTP client with retry" matches "fetchWithRetry" strategies
```

Without `embeddingAdapter`, the SDK falls back to exact pattern matching (still works for known patterns like fetchWithRetry, LRUCache, etc.).

## Built-in Harnesses

| id | Task | Scored by |
|----|------|-----------|
| `js-api` | `fetchWithRetry(url)` — retry + cache | Sandbox (objective) |
| `js-lrucache` | `LRUCache` class | Sandbox (objective) |
| `js-ratelimiter` | `rateLimiter(fn, limit, windowMs)` | Sandbox (objective) |
| `js-circuitbreaker` | `circuitBreaker(fn, threshold, resetMs)` | Sandbox (objective) |
| `js-promisepool` | `runWithLimit(tasks, concurrency)` | Sandbox (objective) |
| `js-tictactoe` | `getBestMove(board)` — minimax | Sandbox (objective) |
| `js-maze` | `findPath(grid, start, end)` — BFS | Sandbox (objective) |
| `js-sudoku` | `solveSudoku(grid)` | Sandbox (objective) |
| `js-wordle` | `guessWord(feedback)` | Sandbox (objective) |
| `free` | Any task, any language | LLM-as-judge |

The `free` harness works for Python, Dart/Flutter, SQL, analysis, architecture decisions — anything. The judge evaluates quality using `projectContext` if provided.

## Custom Harness

```typescript
import { registerPlugin, MeeseeksSDK, BedrockAdapter } from '@meeseeks-sdk/core';

registerPlugin({
  id: 'my-task',
  name: 'My Task',
  description: 'Tests my custom function',
  exampleTask: 'Write myFn(x) that returns x * 2',
  usesEnvironments: false,
  isAlgorithmic: false,
  isFreeMode: false,
  baselineCode: 'module.exports = (x) => x;',
  promptInstructions: 'module.exports = function myFn(x) { ... }',
  buildHarness: (code) => `
    ${code}
    const fn = module.exports;
    const result = fn(21);
    const score = result === 42 ? 10 : 0;
    console.log(JSON.stringify({ score, requests: 0, retries: 0, time_ms: 0, success: score === 10, env: 'test' }));
    process.exit(0);
  `,
});
```

## API

### `new MeeseeksSDK(config)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `adapter` | `LLMAdapter` | required | LLM for generating responses |
| `judgeAdapter` | `LLMAdapter` | same as adapter | Separate LLM for judging (avoids bias) |
| `storage` | `string` | `'.meeseeks/memory.db'` | SQLite path |
| `embeddingAdapter` | `EmbeddingAdapter` | — | Enables semantic strategy search |
| `projectContext` | `string` | — | Stack description injected into judge |
| `minScore` | `number` | `8` | Passing threshold |

### `sdk.run(opts)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `task` | `string` | required | Task description |
| `mode` | `'fast'\|'balanced'\|'quality'` | `'balanced'` | Iteration count |
| `harness` | `string` | auto-detected | Plugin id |
| `minScore` | `number` | from config | Override threshold |
| `projectContext` | `string` | from config | Override context |
| `onIteration` | `function` | — | Progress callback |

Returns `{ code, score, passed, iterations, history }`.

### Low-level: `qualityGate(opts)`

The `MeeseeksSDK` class is built on top of `qualityGate()`. Use it directly for custom orchestration without memory.

## Breaking changes from v0.1.0

- Plugin `js-free` renamed to `free`
- `QualityGateResult` now includes `passed: boolean`
- `QualityGateOptions` now accepts `mode`, `judgeAdapter`, `projectContext`, `memory`

## Hive Mode (coming soon)

Connect to a [Meeseeks Hive](https://github.com/abrahamcasanova/meeseeks-hive) instance for shared team knowledge and pgvector semantic search:

```typescript
// Coming in v0.3.0
const sdk = new MeeseeksSDK({
  adapter: new BedrockAdapter({ region: 'us-east-1' }),
  hiveUrl: process.env.MEESEEKS_HIVE_URL,
});
// Knowledge shared across all developers on your team
```

## License

MIT

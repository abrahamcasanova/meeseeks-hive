# @meeseeks-sdk/core

> A quality gate for LLM-generated code. Wraps any LLM call, executes the output in a sandbox, scores it 0–10, and retries silently until a minimum score is reached.

[![npm version](https://img.shields.io/npm/v/@meeseeks-sdk/core)](https://www.npmjs.com/package/@meeseeks-sdk/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
npm install @meeseeks-sdk/core
```

## Quick Start

```typescript
import { qualityGate, ClaudeAdapter } from '@meeseeks-sdk/core';

const result = await qualityGate({
  task: 'Write fetchWithRetry(url) that retries on failure with exponential backoff. Export as module.exports.',
  adapter: new ClaudeAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
  harness: 'js-api',
  minScore: 8,
  maxRetries: 5,
  onIteration: ({ iteration, score }) => {
    console.log(`iter ${iteration}: score=${score}/10`);
  },
});

console.log(result.code);   // code that scored ≥ 8
console.log(result.score);  // final score (0-10)
console.log(result.iterations); // how many attempts it took
```

## How it works

```
LLM generates code
      ↓
Sandbox executes it (Node.js child process)
      ↓
Score 0-10 based on correctness + efficiency
      ↓
Score ≥ minScore? → return result
Score < minScore? → feed score back to LLM → retry
```

## Supported LLMs

```typescript
import { ClaudeAdapter, OpenAIAdapter, OllamaAdapter, BedrockAdapter } from '@meeseeks-sdk/core';

new ClaudeAdapter({ apiKey: '...' })
new OpenAIAdapter({ apiKey: '...' })
new OllamaAdapter({ baseUrl: 'http://localhost:11434' })
new BedrockAdapter({ region: 'us-east-1' })
```

## Built-in Harnesses

| id | Task |
|----|------|
| `js-api` | `fetchWithRetry(url)` — retry + cache |
| `js-lrucache` | `LRUCache` class |
| `js-ratelimiter` | `rateLimiter(fn, limit, windowMs)` |
| `js-circuitbreaker` | `circuitBreaker(fn, threshold, resetMs)` |
| `js-promisepool` | `runWithLimit(tasks, concurrency)` |
| `js-tictactoe` | `getBestMove(board)` — minimax |
| `js-maze` | `findPath(grid, start, end)` — BFS |
| `js-sudoku` | `solveSudoku(grid)` |
| `js-wordle` | `guessWord(feedback)` |
| `js-free` | Any task — scored by LLM-as-judge |

## Custom Harness

```typescript
import { registerPlugin, qualityGate, ClaudeAdapter } from '@meeseeks-sdk/core';

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

const result = await qualityGate({
  task: 'Write myFn(x) that returns x * 2. Export as module.exports.',
  adapter: new ClaudeAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
  harness: 'my-task',
  minScore: 10,
});
```

## API

### `qualityGate(opts)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `task` | `string` | required | Task description sent to the LLM |
| `adapter` | `LLMAdapter` | required | LLM adapter instance |
| `harness` | `string` | `'js-api'` | Harness plugin id |
| `minScore` | `number` | `8` | Stop when score ≥ this value |
| `maxRetries` | `number` | `5` | Max iterations before returning best result |
| `onIteration` | `function` | — | Called after each iteration with progress info |

Returns `{ code, score, iterations, history }`.

## License

MIT

// Run with: ANTHROPIC_API_KEY=sk-ant-... node test-smoke.mjs
import { qualityGate, ClaudeAdapter } from './dist/index.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Missing ANTHROPIC_API_KEY env var');
  process.exit(1);
}

console.log('Starting smoke test...\n');

const adapter = new ClaudeAdapter({ apiKey });

const result = await qualityGate({
  task: 'Write fetchWithRetry(url) that retries on failure with exponential backoff. Export as module.exports.',
  adapter,
  harness: 'js-api',
  minScore: 8,
  maxRetries: 3,
  onIteration: ({ iteration, score, evalResult, code }) => {
    console.log(`  iter ${iteration}: score=${score}/10 | success=${evalResult.success} | requests=${evalResult.requests} | codeFound=${!!code}`);
  },
});

console.log('\n--- RESULT ---');
console.log(`score:      ${result.score}/10`);
console.log(`iterations: ${result.iterations}`);
console.log(`code lines: ${result.code?.split('\n').length ?? 0}`);

if (result.score >= 8) {
  console.log('\n✓ PASS — quality gate reached score >= 8');
} else {
  console.log('\n✗ FAIL — did not reach score >= 8');
  process.exit(1);
}

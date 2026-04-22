import { query } from '../db/pool.js';
import { getDefaultAdapter } from '../adapters/index.js';
import { pino } from 'pino';

const log = pino({ name: 'strategy' });

export async function assignStrategy(meeseeksId: string, strategy: string): Promise<void> {
  await query(
    `UPDATE meeseeks SET strategy = $2 WHERE id = $1`,
    [meeseeksId, strategy],
  );
}

export async function evolveStrategy(
  parentStrategy: string,
  outcome: 'won' | 'lost',
): Promise<string> {
  try {
    const adapter = getDefaultAdapter();
    const result = await adapter.chat({
      messages: [
        {
          role: 'user',
          content: `A Meeseeks agent used this strategy: "${parentStrategy}"
The result was: ${outcome}.

Generate a slightly ${outcome === 'won' ? 'refined' : 'different'} strategy in one sentence. Be specific and actionable.`,
        },
      ],
      model: 'claude-sonnet-4-6',
      maxTokens: 100,
      temperature: 0.8,
    });

    return result.content.trim();
  } catch (err) {
    log.error(err, 'Strategy evolution failed');
    return parentStrategy;
  }
}

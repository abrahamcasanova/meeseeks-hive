import { ClaudeAdapter as CoreClaudeAdapter } from '@meeseeks/core';
import { config } from '../config.js';

export class ClaudeAdapter extends CoreClaudeAdapter {
  constructor(model?: string) {
    super({ apiKey: config.ANTHROPIC_API_KEY ?? '', model: model ?? config.LLM_MODEL });
  }
}

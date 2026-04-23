import { OpenAIAdapter as CoreOpenAIAdapter } from '@meeseeks-sdk/core';
import { config } from '../config.js';

export class OpenAIAdapter extends CoreOpenAIAdapter {
  constructor(model?: string) {
    super({ apiKey: config.OPENAI_API_KEY ?? '', model: model ?? config.OPENAI_MODEL ?? 'gpt-4o-mini' });
  }
}

import { OllamaAdapter as CoreOllamaAdapter } from '@meeseeks/core';

export class OllamaAdapter extends CoreOllamaAdapter {
  constructor(model?: string, baseUrl?: string) {
    super({ model, baseUrl });
  }
}

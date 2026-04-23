import { BedrockAdapter as CoreBedrockAdapter } from '@meeseeks-sdk/core';
import { config } from '../config.js';

export class BedrockAdapter extends CoreBedrockAdapter {
  constructor(model?: string) {
    super({ model: model ?? config.BEDROCK_CLAUDE_MODEL, region: config.BEDROCK_REGION });
  }
}

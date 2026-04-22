import type { LLMAdapter } from './llm.types.js';
import { ClaudeAdapter } from './claude.adapter.js';
import { BedrockAdapter } from './bedrock.adapter.js';
import { OpenAIAdapter } from './openai.adapter.js';
import { OllamaAdapter } from './ollama.adapter.js';
import { config } from '../config.js';

type AdapterConstructor = new (model?: string) => LLMAdapter;

const registry: Record<string, AdapterConstructor> = {
  claude: ClaudeAdapter,
  bedrock: BedrockAdapter,
  openai: OpenAIAdapter,
  ollama: OllamaAdapter,
};

export function createAdapter(provider?: string, model?: string): LLMAdapter {
  const p = provider ?? config.LLM_PROVIDER;
  const Constructor = registry[p];
  if (!Constructor) {
    throw new Error(`Unknown LLM provider: ${p}. Available: ${Object.keys(registry).join(', ')}`);
  }
  return new Constructor(model);
}

let defaultAdapter: LLMAdapter | null = null;

export function getDefaultAdapter(): LLMAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createAdapter();
  }
  return defaultAdapter;
}

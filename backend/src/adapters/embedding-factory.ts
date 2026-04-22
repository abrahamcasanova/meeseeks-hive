import type { EmbeddingAdapter } from './embedding.types.js';
import { OpenAIEmbeddingAdapter } from './embedding.adapter.js';
import { BedrockEmbeddingAdapter } from './bedrock-embedding.adapter.js';
import { config } from '../config.js';

type EmbeddingAdapterConstructor = new (model?: string, dimensions?: number) => EmbeddingAdapter;

// Register new providers here — no other file needs to change
const registry: Record<string, EmbeddingAdapterConstructor> = {
  openai: OpenAIEmbeddingAdapter,
  bedrock: BedrockEmbeddingAdapter,
};

export function createEmbeddingAdapter(
  provider?: string,
  model?: string,
  dimensions?: number,
): EmbeddingAdapter {
  const p = provider ?? config.EMBEDDING_PROVIDER;
  const Constructor = registry[p];
  if (!Constructor) {
    throw new Error(
      `Unknown embedding provider: "${p}". Available: ${Object.keys(registry).join(', ')}`,
    );
  }
  return new Constructor(model, dimensions);
}

let _default: EmbeddingAdapter | null = null;

export function getDefaultEmbeddingAdapter(): EmbeddingAdapter {
  if (!_default) {
    _default = createEmbeddingAdapter();
  }
  return _default;
}

/** Reset cached singleton — useful in tests or after config changes */
export function resetEmbeddingAdapter(): void {
  _default = null;
}

import type { EmbeddingAdapter } from './embedding.types.js';
import type { OpenAIEmbeddingConfig } from './embedding-config.js';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIM = 1536;

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

export class OpenAIEmbeddingAdapter implements EmbeddingAdapter {
  readonly provider = 'openai';
  readonly model: string;
  readonly dimensions: number;
  private apiKey: string;

  constructor(cfg: OpenAIEmbeddingConfig) {
    this.apiKey = cfg.apiKey;
    this.model = cfg.model ?? DEFAULT_MODEL;
    this.dimensions = cfg.dimensions ?? DEFAULT_DIM;
  }

  async embed(text: string): Promise<number[]> {
    const [result] = await this.embedBatch([text]);
    return result!;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embeddings error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse;
    return data.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);
  }
}

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { EmbeddingAdapter } from './embedding.types.js';
import { config } from '../config.js';

// amazon.titan-embed-text-v2:0 supports 256, 512, or 1024 dimensions
const DEFAULT_MODEL = 'amazon.titan-embed-text-v2:0';
const DEFAULT_DIM = 1024;

interface TitanEmbeddingResponse {
  embedding: number[];
  inputTextTokenCount: number;
}

export class BedrockEmbeddingAdapter implements EmbeddingAdapter {
  readonly provider = 'bedrock';
  readonly model: string;
  readonly dimensions: number;
  private client: BedrockRuntimeClient;

  constructor(model = DEFAULT_MODEL, dimensions = DEFAULT_DIM) {
    this.model = model;
    this.dimensions = dimensions;
    this.client = new BedrockRuntimeClient({ region: config.BEDROCK_REGION });
  }

  async embed(text: string): Promise<number[]> {
    const body = JSON.stringify({
      inputText: text,
      dimensions: this.dimensions,
      normalize: true,
    });

    const command = new InvokeModelCommand({
      modelId: this.model,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(body),
    });

    const response = await this.client.send(command);
    const result = JSON.parse(
      new TextDecoder().decode(response.body),
    ) as TitanEmbeddingResponse;
    return result.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Titan V2 has no batch endpoint — run requests in parallel
    return Promise.all(texts.map(t => this.embed(t)));
  }
}

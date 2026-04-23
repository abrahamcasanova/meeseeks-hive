export interface OpenAIEmbeddingConfig {
  apiKey: string;
  model?: string;      // default: 'text-embedding-3-small'
  dimensions?: number; // default: 1536
}

export interface BedrockEmbeddingConfig {
  region?: string;     // default: 'us-east-1'
  model?: string;      // default: 'amazon.titan-embed-text-v2:0'
  dimensions?: number; // default: 1024
}

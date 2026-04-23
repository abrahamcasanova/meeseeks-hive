export interface ClaudeConfig {
  apiKey: string;
  model?: string;
}

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
}

export interface BedrockConfig {
  region?: string;
  model?: string;
}

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
}

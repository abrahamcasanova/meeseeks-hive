// Main SDK class
export { MeeseeksSDK } from './sdk.js';
export type { MeeseeksSDKConfig, RunOptions } from './sdk.js';

// Quality gate (lower-level API)
export { qualityGate } from './gate/quality-gate.js';
export type { QualityGateOptions, QualityGateResult, IterationInfo, EvalResult } from './gate/quality-gate.js';

// LLM adapters
export { ClaudeAdapter } from './adapters/claude.adapter.js';
export { OpenAIAdapter } from './adapters/openai.adapter.js';
export { OllamaAdapter } from './adapters/ollama.adapter.js';
export { BedrockAdapter } from './adapters/bedrock.adapter.js';
export type { LLMAdapter, ChatParams, ChatResponse, StreamChunk } from './adapters/llm.types.js';
export type { ClaudeConfig, OpenAIConfig, BedrockConfig, OllamaConfig } from './adapters/llm-config.js';

// Embedding adapters (optional — enable knowledge inheritance)
export { OpenAIEmbeddingAdapter } from './adapters/embedding.adapter.js';
export { BedrockEmbeddingAdapter } from './adapters/bedrock-embedding.adapter.js';
export type { EmbeddingAdapter } from './adapters/embedding.types.js';
export type { OpenAIEmbeddingConfig, BedrockEmbeddingConfig } from './adapters/embedding-config.js';

// Plugin registry
export { registerPlugin, getPlugin, listPlugins, buildHarnessWithPlugin, HarnessNotFoundError } from './services/plugin-registry.js';
export type { HarnessPlugin } from './services/plugin-registry.js';

// Sandbox
export { executeCode, extractCodeBlocks } from './services/sandbox.service.js';
export type { ExecutionResult } from './services/sandbox.service.js';

// Storage & memory (advanced usage)
export { StorageService } from './services/storage.service.js';
export type { StrategyRecord } from './services/storage.service.js';
export { StrategyMemoryService, extractTaskPattern } from './services/strategy-memory.service.js';

// Evaluator types
export type { Evaluation, EvaluatorMessage } from './services/evaluator.service.js';

export { qualityGate } from './gate/quality-gate.js';
export type { QualityGateOptions, QualityGateResult, IterationInfo, EvalResult } from './gate/quality-gate.js';

export { ClaudeAdapter } from './adapters/claude.adapter.js';
export { OpenAIAdapter } from './adapters/openai.adapter.js';
export { OllamaAdapter } from './adapters/ollama.adapter.js';
export { BedrockAdapter } from './adapters/bedrock.adapter.js';
export type { LLMAdapter, ChatParams, ChatResponse, StreamChunk } from './adapters/llm.types.js';
export type { ClaudeConfig, OpenAIConfig, BedrockConfig, OllamaConfig } from './adapters/llm-config.js';

export { registerPlugin, getPlugin, listPlugins, buildHarnessWithPlugin, HarnessNotFoundError } from './services/plugin-registry.js';
export type { HarnessPlugin } from './services/plugin-registry.js';

export { executeCode, extractCodeBlocks } from './services/sandbox.service.js';
export type { ExecutionResult } from './services/sandbox.service.js';

export type { Evaluation, EvaluatorMessage } from './services/evaluator.service.js';

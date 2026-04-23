import Anthropic from '@anthropic-ai/sdk';
import type { LLMAdapter, ChatParams, ChatResponse, StreamChunk } from './llm.types.js';
import type { ClaudeConfig } from './llm-config.js';

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic;
  readonly provider = 'claude';
  readonly model: string;

  constructor(cfg: ClaudeConfig) {
    this.client = new Anthropic({ apiKey: cfg.apiKey });
    this.model = cfg.model ?? 'claude-sonnet-4-6';
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const messages = params.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const systemPrompt = params.systemPrompt
      ?? params.messages.find(m => m.role === 'system')?.content;

    const response = await this.client.messages.create({
      model: params.model || this.model,
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0.7,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find(b => b.type === 'text');

    return {
      content: textBlock?.text ?? '',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
      stopReason: response.stop_reason ?? 'unknown',
    };
  }

  async *stream(params: ChatParams): AsyncIterable<StreamChunk> {
    const messages = params.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const systemPrompt = params.systemPrompt
      ?? params.messages.find(m => m.role === 'system')?.content;

    const stream = this.client.messages.stream({
      model: params.model || this.model,
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0.7,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text };
      }
      if (event.type === 'message_delta') {
        yield {
          type: 'usage',
          outputTokens: event.usage.output_tokens,
        };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      type: 'done',
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    };
  }
}

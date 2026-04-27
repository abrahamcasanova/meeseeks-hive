import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type Message as BedrockMessage,
  type SystemContentBlock,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import type { LLMAdapter, ChatParams, ChatResponse, StreamChunk } from './llm.types.js';
import type { BedrockConfig } from './llm-config.js';

export class BedrockAdapter implements LLMAdapter {
  private client: BedrockRuntimeClient;
  readonly provider = 'bedrock';
  readonly model: string;

  constructor(cfg: BedrockConfig = {}) {
    this.model = cfg.model ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
    this.client = new BedrockRuntimeClient({ region: cfg.region ?? 'us-east-2' });
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const { messages, system } = this.buildMessages(params);
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const command = new ConverseCommand({
          modelId: this.model,
          messages,
          system,
          inferenceConfig: {
            maxTokens: params.maxTokens ?? 1024,
            temperature: params.temperature ?? 0.7,
          },
        });

        const response = await this.client.send(command);

        const textBlock = response.output?.message?.content?.find(
          (b): b is ContentBlock.TextMember => 'text' in b,
        );

        return {
          content: textBlock?.text ?? '',
          inputTokens: response.usage?.inputTokens ?? 0,
          outputTokens: response.usage?.outputTokens ?? 0,
          model: this.model,
          stopReason: response.stopReason ?? 'unknown',
        };
      } catch (err) {
        const isThrottle = (err as { name?: string }).name === 'ThrottlingException'
          || (err as { message?: string }).message?.includes('Too many requests');
        if (!isThrottle || attempt === MAX_RETRIES) throw err;
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('Bedrock: max retries exceeded');
  }

  async *stream(params: ChatParams): AsyncIterable<StreamChunk> {
    const { messages, system } = this.buildMessages(params);
    const MAX_RETRIES = 3;

    let response;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const command = new ConverseStreamCommand({
          modelId: this.model,
          messages,
          system,
          inferenceConfig: {
            maxTokens: params.maxTokens ?? 1024,
            temperature: params.temperature ?? 0.7,
          },
        });
        response = await this.client.send(command);
        break;
      } catch (err) {
        const isThrottle = (err as { name?: string }).name === 'ThrottlingException'
          || (err as { message?: string }).message?.includes('Too many requests');
        if (!isThrottle || attempt === MAX_RETRIES) throw err;
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
      }
    }

    if (!response?.stream) {
      yield { type: 'error', error: 'No stream in Bedrock response' };
      return;
    }

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of response!.stream!) {
      if (event.contentBlockDelta?.delta && 'text' in event.contentBlockDelta.delta) {
        yield { type: 'text', text: event.contentBlockDelta.delta.text };
      }

      if (event.metadata?.usage) {
        inputTokens = event.metadata.usage.inputTokens ?? 0;
        outputTokens = event.metadata.usage.outputTokens ?? 0;
      }
    }

    yield { type: 'done', inputTokens, outputTokens };
  }

  private buildMessages(params: ChatParams): {
    messages: BedrockMessage[];
    system: SystemContentBlock[] | undefined;
  } {
    const systemPrompt = params.systemPrompt
      ?? params.messages.find(m => m.role === 'system')?.content;

    const system: SystemContentBlock[] | undefined = systemPrompt
      ? [{ text: systemPrompt }]
      : undefined;

    const messages: BedrockMessage[] = params.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: [{ text: m.content }],
      }));

    return { messages, system };
  }
}

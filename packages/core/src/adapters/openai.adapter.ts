import type { LLMAdapter, ChatParams, ChatResponse, StreamChunk } from './llm.types.js';
import type { OpenAIConfig } from './llm-config.js';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIAdapter implements LLMAdapter {
  readonly provider = 'openai';
  readonly model: string;
  private apiKey: string;

  constructor(cfg: OpenAIConfig) {
    this.apiKey = cfg.apiKey;
    this.model = cfg.model ?? 'gpt-4o-mini';
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const messages: OpenAIMessage[] = params.messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    if (params.systemPrompt && !messages.some(m => m.role === 'system')) {
      messages.unshift({ role: 'system', content: params.systemPrompt });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model || this.model,
        messages,
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const choice = data.choices[0];

    return {
      content: choice?.message.content ?? '',
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
      model: data.model,
      stopReason: choice?.finish_reason ?? 'unknown',
    };
  }

  async *stream(params: ChatParams): AsyncIterable<StreamChunk> {
    const messages: OpenAIMessage[] = params.messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    if (params.systemPrompt && !messages.some(m => m.role === 'system')) {
      messages.unshift({ role: 'system', content: params.systemPrompt });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model || this.model,
        messages,
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body from OpenAI streaming');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const jsonStr = trimmed.slice(6);
            const chunk = JSON.parse(jsonStr) as OpenAIStreamChunk;

            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              yield { type: 'text', text: delta.content };
            }

            if (chunk.usage) {
              totalInputTokens = chunk.usage.prompt_tokens;
              totalOutputTokens = chunk.usage.completion_tokens;
              yield { type: 'usage', outputTokens: chunk.usage.completion_tokens };
            }
          } catch {
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield {
      type: 'done',
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }
}

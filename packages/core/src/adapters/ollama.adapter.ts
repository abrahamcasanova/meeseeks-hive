import type { LLMAdapter, ChatParams, ChatResponse, StreamChunk } from './llm.types.js';
import type { OllamaConfig } from './llm-config.js';

export class OllamaAdapter implements LLMAdapter {
  readonly provider = 'ollama';
  readonly model: string;
  private baseUrl: string;

  constructor(cfg: OllamaConfig = {}) {
    this.model = cfg.model ?? 'llama3.2';
    this.baseUrl = cfg.baseUrl ?? 'http://localhost:11434';
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const messages = params.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: params.model || this.model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      message: { content: string };
      eval_count?: number;
      prompt_eval_count?: number;
    };

    return {
      content: data.message.content,
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
      model: params.model || this.model,
      stopReason: 'stop',
    };
  }

  async *stream(params: ChatParams): AsyncIterable<StreamChunk> {
    const messages = params.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: params.model || this.model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      yield { type: 'error', error: `Ollama error: ${response.status}` };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let totalOutput = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
      for (const line of lines) {
        const data = JSON.parse(line) as { message?: { content: string }; done: boolean; eval_count?: number };
        if (data.message?.content) {
          yield { type: 'text', text: data.message.content };
        }
        if (data.done && data.eval_count) {
          totalOutput = data.eval_count;
        }
      }
    }

    yield { type: 'done', inputTokens: 0, outputTokens: totalOutput };
  }
}

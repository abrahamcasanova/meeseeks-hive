# Adapters LLM

> Conectores para diferentes proveedores de LLM

## Arquitectura

```
┌─────────────┐
│   Manager   │
└──────┬──────┘
       │ call()
       ▼
┌─────────────┐
│   Factory   │ ← Selecciona adapter según config
└──────┬──────┘
       │
  ┌────┴────┬────────┐
  ▼         ▼        ▼
┌─────┐  ┌─────┐  ┌──────┐
│Claude│  │Bedrock│ │Ollama│
└─────┘  └─────┘  └──────┘
```

## Interface Común

```typescript
// backend/src/adapters/llm.types.ts
export interface LLMAdapter {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  stream(messages: Message[], options?: ChatOptions): AsyncGenerator<string>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

## Claude Adapter

**Archivo**: `backend/src/adapters/claude.adapter.ts`

Conexión directa a la API de Anthropic:

```typescript
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic;
  
  constructor() {
    this.client = new Anthropic({
      apiKey: config.CLAUDE_API_KEY
    });
  }
  
  async chat(messages: Message[]) {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });
    
    return {
      content: response.content[0].text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    };
  }
}
```

## Bedrock Adapter

**Archivo**: `backend/src/adapters/bedrock.adapter.ts`

Conexión a Claude via AWS Bedrock:

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export class BedrockAdapter implements LLMAdapter {
  private client: BedrockRuntimeClient;
  
  constructor() {
    this.client = new BedrockRuntimeClient({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY
      }
    });
  }
  
  async chat(messages: Message[]) {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        messages,
        max_tokens: 4096
      })
    });
    
    const response = await this.client.send(command);
    // ...parse response
  }
}
```

## Ollama Adapter

**Archivo**: `backend/src/adapters/ollama.adapter.ts`

Conexión a modelos locales via Ollama:

```typescript
export class OllamaAdapter implements LLMAdapter {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = config.OLLAMA_URL || 'http://localhost:11434';
  }
  
  async chat(messages: Message[]) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        model: config.OLLAMA_MODEL || 'llama2',
        messages,
        stream: false
      })
    });
    
    const data = await response.json();
    return {
      content: data.message.content,
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0
      }
    };
  }
}
```

## Adapter Factory

**Archivo**: `backend/src/adapters/adapter-factory.ts`

```typescript
import { config } from '../config';
import { ClaudeAdapter } from './claude.adapter';
import { BedrockAdapter } from './bedrock.adapter';
import { OllamaAdapter } from './ollama.adapter';

export function createAdapter(): LLMAdapter {
  switch (config.LLM_ADAPTER) {
    case 'claude':
      return new ClaudeAdapter();
    case 'bedrock':
      return new BedrockAdapter();
    case 'ollama':
      return new OllamaAdapter();
    default:
      return new ClaudeAdapter();
  }
}

// Singleton
let adapter: LLMAdapter;
export function getAdapter() {
  if (!adapter) {
    adapter = createAdapter();
  }
  return adapter;
}
```

## Configuración

```bash
# .env
LLM_ADAPTER=claude  # claude | bedrock | ollama

# Claude directo
CLAUDE_API_KEY=sk-ant-...

# Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

## Embedding Adapter

**Archivo**: `backend/src/adapters/embedding.adapter.ts`

Para futura búsqueda semántica de estrategias:

```typescript
export async function getEmbedding(text: string): Promise<number[]> {
  // Usando Claude o modelo dedicado
  // Return vector de N dimensiones
}
```

## Ver También
- [[Configuración]] - Variables de entorno
- [[Backend]] - Uso de adapters
- [[Managers#Autonomous Manager]] - Llamadas al LLM

## Tags
#llm #adapters #claude #bedrock #ollama

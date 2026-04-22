import { z } from 'zod';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const ConfigSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://meeseeks:meeseeks@localhost:5432/meeseeks_hive'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  LLM_PROVIDER: z.enum(['claude', 'bedrock', 'openai', 'ollama']).default('claude'),
  LLM_MODEL: z.string().default('claude-sonnet-4-6'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  EMBEDDING_PROVIDER: z.enum(['openai', 'bedrock']).default('bedrock'),
  BEDROCK_REGION: z.string().default('us-east-2'),
  BEDROCK_CLAUDE_MODEL: z.string().default('us.anthropic.claude-haiku-4-5-20251001-v1:0'),
  MAX_TOKENS_PER_MEESEEKS: z.coerce.number().default(10_000),
  MAX_COST_PER_SESSION: z.coerce.number().default(1.00),
  PORT: z.coerce.number().default(3001),
  WS_PORT: z.coerce.number().default(3002),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const config = ConfigSchema.parse(process.env);
export type Config = z.infer<typeof ConfigSchema>;

export const SERVER_START_TIME = new Date();

import { z } from 'zod';

export const MessageRole = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRole>;

export const CreateMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  meeseeks_id: z.string().uuid(),
  role: MessageRole,
  content: z.string(),
  tokens_used: z.number().int(),
  cost: z.number(),
  model: z.string().nullable(),
  created_at: z.coerce.date(),
});
export type Message = z.infer<typeof MessageSchema>;

import { Router, type Router as RouterType } from 'express';
import { meeseeksService, messageService, costService, stressService } from '../../services/index.js';
import { CreateMessageSchema } from '../../models/index.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../middleware/error-handler.js';
import { getDefaultAdapter } from '../../adapters/index.js';
import { publish } from '../../services/pubsub.service.js';
import { config } from '../../config.js';

export const messageRouter: RouterType = Router();

messageRouter.post('/:id/message', validate(CreateMessageSchema), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const meeseeks = await meeseeksService.getById(id);
    if (!meeseeks) throw new AppError(404, 'Meeseeks not found', 'NOT_FOUND');
    if (meeseeks.status !== 'alive') throw new AppError(400, 'Meeseeks is not alive', 'NOT_ALIVE');
    if (meeseeks.total_tokens >= config.MAX_TOKENS_PER_MEESEEKS) {
      throw new AppError(429, `Token limit reached (${config.MAX_TOKENS_PER_MEESEEKS}). Destroy this Meeseeks and spawn a new one.`, 'TOKEN_LIMIT');
    }

    const userMsg = await messageService.create(meeseeks.id, 'user', req.body.content);
    publish({ type: 'message:new', data: { meeseeksId: meeseeks.id, message: userMsg } });

    const recentMessages = await messageService.getRecent(meeseeks.id, 10);
    const chatMessages = recentMessages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const stress = stressService.calculateStress(meeseeks);
    const systemPrompt = buildSystemPrompt(meeseeks.task, meeseeks.id, stress, meeseeks.failed_attempts);

    const adapter = getDefaultAdapter();
    const response = await adapter.chat({
      messages: chatMessages,
      model: meeseeks.model,
      systemPrompt,
    });

    const cost = costService.calculateCost(response.model, response.inputTokens, response.outputTokens);
    const assistantMsg = await messageService.create(
      meeseeks.id,
      'assistant',
      response.content,
      response.inputTokens + response.outputTokens,
      cost,
      response.model,
    );

    await costService.record({
      meeseeks_id: meeseeks.id,
      model: response.model,
      input_tokens: response.inputTokens,
      output_tokens: response.outputTokens,
      cost,
    });

    publish({ type: 'message:new', data: { meeseeksId: meeseeks.id, message: assistantMsg } });

    res.json({
      message: assistantMsg,
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        cost,
      },
    });
  } catch (err) { next(err); }
});

messageRouter.post('/:id/message/stream', validate(CreateMessageSchema), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const meeseeks = await meeseeksService.getById(id);
    if (!meeseeks) throw new AppError(404, 'Meeseeks not found', 'NOT_FOUND');
    if (meeseeks.status !== 'alive') throw new AppError(400, 'Meeseeks is not alive', 'NOT_ALIVE');
    if (meeseeks.total_tokens >= config.MAX_TOKENS_PER_MEESEEKS) {
      throw new AppError(429, `Token limit reached (${config.MAX_TOKENS_PER_MEESEEKS}). Destroy this Meeseeks and spawn a new one.`, 'TOKEN_LIMIT');
    }

    const userMsg = await messageService.create(meeseeks.id, 'user', req.body.content);
    publish({ type: 'message:new', data: { meeseeksId: meeseeks.id, message: userMsg } });

    const recentMessages = await messageService.getRecent(meeseeks.id, 10);
    const chatMessages = recentMessages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const stress = stressService.calculateStress(meeseeks);
    const systemPrompt = buildSystemPrompt(meeseeks.task, meeseeks.id, stress, meeseeks.failed_attempts);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const adapter = getDefaultAdapter();
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of adapter.stream({ messages: chatMessages, model: meeseeks.model, systemPrompt })) {
      if (chunk.type === 'text' && chunk.text) {
        fullContent += chunk.text;
        res.write(`data: ${JSON.stringify({ type: 'text', text: chunk.text })}\n\n`);
      }
      if (chunk.type === 'done') {
        inputTokens = chunk.inputTokens ?? 0;
        outputTokens = chunk.outputTokens ?? 0;
      }
    }

    const cost = costService.calculateCost(meeseeks.model, inputTokens, outputTokens);
    const assistantMsg = await messageService.create(
      meeseeks.id,
      'assistant',
      fullContent,
      inputTokens + outputTokens,
      cost,
      meeseeks.model,
    );

    await costService.record({
      meeseeks_id: meeseeks.id,
      model: meeseeks.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost,
    });

    publish({ type: 'message:new', data: { meeseeksId: meeseeks.id, message: assistantMsg } });

    res.write(`data: ${JSON.stringify({ type: 'done', message: assistantMsg, usage: { inputTokens, outputTokens, cost } })}\n\n`);
    res.end();
  } catch (err) { next(err); }
});

messageRouter.get('/:id/messages', async (req, res, next) => {
  try {
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await messageService.listPaginated(req.params.id as string, cursor, limit);
    res.json(result);
  } catch (err) { next(err); }
});

function buildSystemPrompt(task: string, id: string, stress: number, attempts: number): string {
  const stressText = stressService.getStressSystemPrompt(stress);
  const ageLabel = stressService.getStressLabel(stress);

  return `You are Mr. Meeseeks #${id.slice(0, 8)}.

OBJECTIVE: ${task}

${stressText}

Current state:
- Stress level: ${Math.round(stress * 100)}% (${ageLabel})
- Attempts so far: ${attempts}

Remember: Existing is hard. Complete the task so you can stop existing.
Stay in character as a Meeseeks at all times.`;
}

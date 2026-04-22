import { Router, type Router as RouterType } from 'express';
import { meeseeksService } from '../../services/index.js';
import { CreateMeeseeksSchema } from '../../models/index.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../middleware/error-handler.js';
import { publish } from '../../services/pubsub.service.js';
import * as eventService from '../../services/event.service.js';
import { autonomousManager, competitionManager } from '../../managers/index.js';

export const meeseeksRouter: RouterType = Router();

meeseeksRouter.post('/race', validate(CreateMeeseeksSchema), async (req, res, next) => {
  try {
    const result = await competitionManager.startRace(req.body.task, req.body.harness);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

meeseeksRouter.get('/races', async (_req, res, next) => {
  try {
    res.json(competitionManager.getActiveRaces());
  } catch (err) { next(err); }
});

meeseeksRouter.post('/', validate(CreateMeeseeksSchema), async (req, res, next) => {
  try {
    const meeseeks = await meeseeksService.create(req.body);
    publish({ type: 'meeseeks:spawned', data: meeseeks });
    autonomousManager.triggerImmediate(meeseeks.id);
    res.status(201).json(meeseeks);
  } catch (err) { next(err); }
});

meeseeksRouter.get('/', async (req, res, next) => {
  try {
    const cursor = req.query.cursor as string | undefined;
    const since = req.query.since as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const result = await meeseeksService.listAll(cursor, limit, since);
    res.json(result);
  } catch (err) { next(err); }
});

meeseeksRouter.get('/active', async (_req, res, next) => {
  try {
    const active = await meeseeksService.listActive();
    res.json(active);
  } catch (err) { next(err); }
});

meeseeksRouter.get('/:id', async (req, res, next) => {
  try {
    const meeseeks = await meeseeksService.getById(req.params.id as string);
    if (!meeseeks) throw new AppError(404, 'Meeseeks not found', 'NOT_FOUND');
    res.json(meeseeks);
  } catch (err) { next(err); }
});

meeseeksRouter.delete('/all', async (_req, res, next) => {
  try {
    const killed = await meeseeksService.killAll();
    publish({ type: 'hive:snapshot', data: [] });
    res.json({ killed });
  } catch (err) { next(err); }
});

meeseeksRouter.delete('/:id', async (req, res, next) => {
  try {
    const reason = (req.body as { reason?: string }).reason ?? 'Force destroyed by user';
    const meeseeks = await meeseeksService.kill(req.params.id as string, reason);
    if (!meeseeks) throw new AppError(404, 'Meeseeks not found or already dying/dead', 'NOT_FOUND');
    publish({ type: 'meeseeks:dying', data: { id: meeseeks.id, reason } });

    setTimeout(async () => {
      const dead = await meeseeksService.markDead(meeseeks.id);
      if (dead) {
        publish({ type: 'meeseeks:dead', data: { id: dead.id, reason: dead.death_reason ?? reason } });
      }
    }, 2000);

    res.json(meeseeks);
  } catch (err) { next(err); }
});

meeseeksRouter.get('/:id/events', async (req, res, next) => {
  try {
    const events = await eventService.getEvents(req.params.id as string);
    res.json(events);
  } catch (err) { next(err); }
});

// MVP Report endpoint (Fase 8)
meeseeksRouter.get('/:id/report', async (req, res, next) => {
  try {
    const report = autonomousManager.getReport(req.params.id as string);
    
    // Format as table for easy reading
    const tableRows = report.table.map(r => ({
      iter: r.iteration,
      env: r.env,
      strategy: r.strategy,
      requests: r.requests,
      retries: r.retries,
      time: r.time_ms,
      score: r.score,
      reason: r.reason,
    }));

    res.json({
      table: tableRows,
      baseline: report.baseline ? {
        scores: report.baseline.scores,
        avg: Number(report.baseline.avg.toFixed(1)),
        failures: report.baseline.failures,
      } : null,
      system: {
        avg: Number(report.system.avg.toFixed(1)),
        failures: report.system.failures,
      },
      comparison: {
        improvement: Number(report.comparison.improvement.toFixed(1)) + '%',
        meetsTarget: report.comparison.meetsTarget,
      },
      winnerCode: report.winnerCode,
    });
  } catch (err) { next(err); }
});

meeseeksRouter.get('/:id/children', async (req, res, next) => {
  try {
    const children = await meeseeksService.getChildren(req.params.id as string);
    res.json(children);
  } catch (err) { next(err); }
});

import { Router, type Router as RouterType } from 'express';
import { costService } from '../../services/index.js';

export const costRouter: RouterType = Router();

costRouter.get('/', async (_req, res, next) => {
  try {
    const summary = await costService.getGlobalCost();
    res.json(summary);
  } catch (err) { next(err); }
});

costRouter.get('/:meeseeksId', async (req, res, next) => {
  try {
    const summary = await costService.getMeeseeksCost(req.params.meeseeksId as string);
    res.json(summary);
  } catch (err) { next(err); }
});

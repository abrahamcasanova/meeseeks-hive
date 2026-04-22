import { Router, type Router as RouterType } from 'express';
import { getForensicsReport } from '../../services/forensics.service.js';
import { AppError } from '../../middleware/error-handler.js';

export const forensicsRouter: RouterType = Router();

forensicsRouter.get('/:id', async (req, res, next) => {
  try {
    const report = await getForensicsReport(req.params.id as string);
    if (!report) throw new AppError(404, 'Meeseeks not found', 'NOT_FOUND');
    res.json(report);
  } catch (err) { next(err); }
});

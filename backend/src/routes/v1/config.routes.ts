import { Router, type Router as RouterType } from 'express';
import { getConfig, patchConfig, resetConfig } from '../../services/runtime-config.service.js';

export const configRouter: RouterType = Router();

configRouter.get('/', (_req, res) => {
  res.json(getConfig());
});

configRouter.patch('/', (req, res) => {
  const updated = patchConfig(req.body);
  res.json(updated);
});

configRouter.post('/reset', (_req, res) => {
  const reset = resetConfig();
  res.json(reset);
});

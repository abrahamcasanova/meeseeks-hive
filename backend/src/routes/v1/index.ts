import { Router, type Router as RouterType } from 'express';
import { meeseeksRouter } from './meeseeks.routes.js';
import { messageRouter } from './message.routes.js';
import { costRouter } from './cost.routes.js';
import { forensicsRouter } from './forensics.routes.js';
import { configRouter } from './config.routes.js';
import { SERVER_START_TIME } from '../../config.js';
import { listPlugins, type HarnessPlugin } from '../../services/plugin-registry.js';

export const v1Router: RouterType = Router();

v1Router.get('/session', (_req, res) => {
  res.json({ startedAt: SERVER_START_TIME.toISOString() });
});

v1Router.get('/plugins', (_req, res) => {
  res.json(listPlugins().map((p: HarnessPlugin) => ({ id: p.id, name: p.name, description: p.description, exampleTask: p.exampleTask })));
});

v1Router.use('/meeseeks', meeseeksRouter);
v1Router.use('/meeseeks', messageRouter);
v1Router.use('/costs', costRouter);
v1Router.use('/forensics', forensicsRouter);
v1Router.use('/config', configRouter);

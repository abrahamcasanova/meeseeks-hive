import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { pino } from 'pino';
import { v1Router } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { startWsServer, stopWsServer } from './websocket/index.js';
import { initPubSub, closePubSub } from './services/pubsub.service.js';
import { pool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { lifecycleManager, autonomousManager, competitionManager } from './managers/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const log = pino({
  transport: config.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});

const app: Express = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(cors());
app.use(compression());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    llmProvider: config.LLM_PROVIDER,
    bedrockModel: config.BEDROCK_CLAUDE_MODEL,
    bedrockRegion: config.BEDROCK_REGION,
  });
});

app.use('/api/v1', v1Router);

// Serve frontend in production (docker / built mode)
if (config.NODE_ENV === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(errorHandler);

// Run migrations then start server
await runMigrations();

const server = app.listen(config.PORT, () => {
  log.info(`Meeseeks Hive API running on :${config.PORT}`);
});

startWsServer();
initPubSub();
lifecycleManager.start();
autonomousManager.start();
competitionManager.start();

async function shutdown(): Promise<void> {
  log.info('Shutting down...');
  lifecycleManager.stop();
  autonomousManager.stop();
  competitionManager.stop();
  stopWsServer();
  closePubSub();
  await pool.end();
  server.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, log };

import { WebSocketServer, WebSocket } from 'ws';
import type { WsEvent } from './ws-events.js';
import { config } from '../config.js';
import { pino } from 'pino';

const log = pino({ name: 'ws-server' });

const BATCH_INTERVAL_MS = 200;
const HEARTBEAT_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();
let batchBuffer: WsEvent[] = [];
let batchTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startWsServer(): WebSocketServer {
  wss = new WebSocketServer({ port: config.WS_PORT });

  wss.on('connection', (ws) => {
    clients.add(ws);
    log.info(`Client connected (total: ${clients.size})`);

    (ws as WebSocket & { isAlive: boolean }).isAlive = true;
    ws.on('pong', () => {
      (ws as WebSocket & { isAlive: boolean }).isAlive = true;
    });

    ws.on('close', () => {
      clients.delete(ws);
      log.info(`Client disconnected (total: ${clients.size})`);
    });

    ws.on('error', (err) => {
      log.error(err, 'WebSocket client error');
      clients.delete(ws);
    });
  });

  batchTimer = setInterval(flushBatch, BATCH_INTERVAL_MS);

  heartbeatTimer = setInterval(() => {
    for (const ws of clients) {
      const extended = ws as WebSocket & { isAlive: boolean };
      if (!extended.isAlive) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      extended.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  log.info(`WebSocket server running on :${config.WS_PORT}`);
  return wss;
}

export function broadcast(event: WsEvent): void {
  batchBuffer.push(event);
}

export function broadcastImmediate(event: WsEvent): void {
  const payload = JSON.stringify([event]);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function flushBatch(): void {
  if (batchBuffer.length === 0) return;
  const events = batchBuffer;
  batchBuffer = [];

  const payload = JSON.stringify(events);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

export function sendToClient(ws: WebSocket, event: WsEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify([event]));
  }
}

export function getClientCount(): number {
  return clients.size;
}

export function stopWsServer(): void {
  if (batchTimer) clearInterval(batchTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (wss) wss.close();
}

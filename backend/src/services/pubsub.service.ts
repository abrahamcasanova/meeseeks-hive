import Redis from 'ioredis';
import { config } from '../config.js';
import { broadcast } from '../websocket/index.js';
import type { WsEvent } from '../websocket/index.js';
import { pino } from 'pino';

const log = pino({ name: 'pubsub' });

const CHANNEL = 'meeseeks-hive:events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pub: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sub: any = null;

export function initPubSub(): void {
  try {
    pub = new (Redis as any)(config.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
    sub = new (Redis as any)(config.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });

    pub.connect().catch((err: unknown) => log.warn(err, 'Redis pub connect failed — running without PubSub'));
    sub.connect().then(() => {
      sub.subscribe(CHANNEL).catch((err: unknown) => log.warn(err, 'Redis subscribe failed'));
      sub.on('message', (_channel: string, message: string) => {
        try {
          const event = JSON.parse(message) as WsEvent;
          broadcast(event);
        } catch {
          log.warn('Invalid PubSub message');
        }
      });
    }).catch((err: unknown) => log.warn(err, 'Redis sub connect failed — running without PubSub'));
  } catch (err) {
    log.warn(err, 'Failed to initialize Redis — running without PubSub');
  }
}

export function publish(event: WsEvent): void {
  if (pub && pub.status === 'ready') {
    pub.publish(CHANNEL, JSON.stringify(event)).catch(() => {});
  }
  broadcast(event);
}

export function closePubSub(): void {
  pub?.disconnect();
  sub?.disconnect();
}

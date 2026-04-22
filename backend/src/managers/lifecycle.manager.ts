import * as meeseeksService from '../services/meeseeks.service.js';
import { calculateStress, getStressLabel, STRESS_CHECK_INTERVAL_MS } from '../services/stress.service.js';
import { getScoreHistory } from './autonomous.manager.js';
import { publish } from '../services/pubsub.service.js';
import { pino } from 'pino';

const log = pino({ name: 'lifecycle' });

let tickInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

export function start(): void {
  if (isRunning) return;
  isRunning = true;
  tickInterval = setInterval(tick, STRESS_CHECK_INTERVAL_MS);
  log.info(`Lifecycle manager started (interval: ${STRESS_CHECK_INTERVAL_MS}ms)`);
}

export function stop(): void {
  isRunning = false;
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  log.info('Lifecycle manager stopped');
}

async function tick(): Promise<void> {
  try {
    const alive = await meeseeksService.listActive();

    for (const m of alive) {
      const scores = getScoreHistory(m.id);
      const stress = calculateStress(m, scores);
      const rounded = Math.round(stress * 100) / 100;

      if (Math.abs(rounded - m.stress) > 0.01) {
        await meeseeksService.updateStress(m.id, rounded);
        publish({
          type: 'meeseeks:stress',
          data: { id: m.id, stress: rounded, label: getStressLabel(stress) },
        });
      }

      if (stress >= 1.0) {
        await beginDeath(m.id, 'Stress reached maximum — existence became unbearable');
      }
    }
  } catch (err) {
    log.error(err, 'Lifecycle tick error');
  }
}

async function beginDeath(id: string, reason: string): Promise<void> {
  const dying = await meeseeksService.kill(id, reason);
  if (!dying) return;

  publish({ type: 'meeseeks:dying', data: { id, reason } });
  log.info({ id: id.slice(0, 8), reason }, 'Meeseeks dying');

  setTimeout(async () => {
    try {
      const dead = await meeseeksService.markDead(id);
      if (dead) {
        publish({ type: 'meeseeks:dead', data: { id, reason: dead.death_reason ?? reason } });
        log.info({ id: id.slice(0, 8) }, 'Meeseeks dead');
      }
    } catch (err) {
      log.error(err, 'Error marking meeseeks dead');
    }
  }, 2000);
}

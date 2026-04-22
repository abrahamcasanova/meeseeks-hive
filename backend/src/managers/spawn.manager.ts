import * as meeseeksService from '../services/meeseeks.service.js';
import { emitEvent } from '../services/event.service.js';
import { publish } from '../services/pubsub.service.js';
import { MAX_SPAWN_DEPTH, MAX_ACTIVE_MANAGERS, type MeeseeksRole } from '../models/index.js';
import { pino } from 'pino';

const log = pino({ name: 'spawn' });

export async function spawnChild(
  parentId: string,
  task: string,
  role: MeeseeksRole = 'worker',
): Promise<{ id: string } | null> {
  const parent = await meeseeksService.getById(parentId);
  if (!parent || parent.status !== 'alive') {
    log.warn({ parentId: parentId.slice(0, 8) }, 'Cannot spawn: parent not alive');
    return null;
  }

  if (parent.spawn_depth >= MAX_SPAWN_DEPTH) {
    log.warn({ parentId: parentId.slice(0, 8), depth: parent.spawn_depth }, 'Cannot spawn: max depth reached');
    return null;
  }

  if (role === 'manager') {
    const managerCount = await meeseeksService.getActiveManagerCount();
    if (managerCount >= MAX_ACTIVE_MANAGERS) {
      log.warn('Cannot spawn manager: max active managers reached');
      return null;
    }
  }

  const child = await meeseeksService.create({
    task,
    role,
    parentId,
    model: parent.model,
    harness: parent.harness, // inherit harness so sub-agents run the same plugin
  });

  await emitEvent(parentId, 'sub_spawned', { childId: child.id, childTask: task });
  publish({ type: 'meeseeks:spawned', data: child });
  log.info({ parentId: parentId.slice(0, 8), childId: child.id.slice(0, 8), role }, 'Child spawned');

  return { id: child.id };
}

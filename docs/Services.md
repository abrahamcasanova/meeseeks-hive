# Services

> Lógica de negocio y operaciones del sistema

## Overview

```
services/
├── sandbox.service.ts       ← Ejecución de código
├── meeseeks.service.ts      ← CRUD de agentes
├── evaluator.service.ts     ← Evaluación de calidad
├── strategy-memory.service.ts ← Memoria de estrategias
├── message.service.ts       ← Historial de conversación
├── event.service.ts         ← Registro de eventos
├── cost.service.ts          ← Tracking de costos
├── forensics.service.ts     ← Análisis post-mortem
├── stress.service.ts        ← Cálculo de stress
└── pubsub.service.ts        ← Event emitter interno
```

## Sandbox

**Archivo**: `backend/src/services/sandbox.service.ts`

Ejecuta código generado en un entorno aislado.

### buildTestHarness()

Construye el harness de prueba con mocks:

```typescript
export function buildTestHarness(
  code: string, 
  task: string, 
  iteration: number
): string {
  const env = envs[(iteration - 1) % envs.length];
  
  return `
    const __env = '${env}';
    const __iteration = ${iteration};
    let __totalRequests = 0;
    let __gotData = false;
    
    // Mock de fetch/https con __shouldFail()
    function __shouldFail(callNum) {
      if (__env === 'easy') return false;
      if (__env === 'medium') return callNum === 1;
      if (__env === 'hard') return callNum <= 2;
      if (__env === 'random') return false;
      return callNum === 1; // chaos
    }
    
    // ... mock implementations ...
    
    ${code}
    
    // Execute and measure
    const start = Date.now();
    await module.exports('https://api.test.com/data');
    const time = Date.now() - start;
    
    // Calculate score
    // Ver [[Sistema de Scoring]]
  `;
}
```

### executeInSandbox()

```typescript
export async function executeInSandbox(harness: string) {
  const vm = new VM({
    timeout: 5000,
    sandbox: { require, console, setTimeout, ... }
  });
  
  try {
    const result = await vm.run(harness);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

## Meeseeks Service

**Archivo**: `backend/src/services/meeseeks.service.ts`

CRUD de agentes:

```typescript
export const meeseeksService = {
  create(input) { /* INSERT INTO meeseeks */ },
  get(id) { /* SELECT * FROM meeseeks WHERE id = $1 */ },
  update(id, patch) { /* UPDATE meeseeks SET ... */ },
  kill(id, reason) { /* UPDATE status = 'dead' */ },
  getAlive() { /* SELECT * WHERE status = 'alive' */ },
  getChildren(id) { /* SELECT * WHERE parent_id = $1 */ },
};
```

## Evaluator Service

**Archivo**: `backend/src/services/evaluator.service.ts`

Evalúa la calidad del código (legacy, ahora en sandbox):

```typescript
export function evaluate(code: string, output: any) {
  let score = 0;
  const reasons = [];
  
  // Criterios de evaluación
  if (output.gotData) {
    score += 5;
    reasons.push('+5 got data');
  }
  // ...
  
  return { score, reasons };
}
```

## Strategy Memory

**Archivo**: `backend/src/services/strategy-memory.service.ts`

Almacena y recupera estrategias efectivas:

```typescript
interface StrategyEntry {
  name: string;
  code: string;
  env: string;
  score: number;
  iteration: number;
}

const memory = new Map<string, StrategyEntry[]>();

export function remember(meeseeksId: string, entry: StrategyEntry) {
  const entries = memory.get(meeseeksId) || [];
  entries.push(entry);
  memory.set(meeseeksId, entries);
}

export function findBest(meeseeksId: string, env: string) {
  const entries = memory.get(meeseeksId) || [];
  return entries
    .filter(e => e.env === env)
    .sort((a, b) => b.score - a.score)[0];
}
```

## Message Service

```typescript
export const messageService = {
  create(meeseeksId, role, content) { /* INSERT */ },
  getHistory(meeseeksId, limit) { /* SELECT ORDER BY created_at */ },
  getWithCursor(meeseeksId, cursor, limit) { /* Pagination */ },
};
```

## Event Service

```typescript
export const eventService = {
  log(meeseeksId, eventType, payload) { /* INSERT */ },
  getEvents(meeseeksId) { /* SELECT */ },
};
```

## Cost Service

```typescript
export const costService = {
  log(meeseeksId, operation, tokens, cost) { /* INSERT */ },
  getGlobal() { /* SUM all costs */ },
  getForMeeseeks(id) { /* SUM for specific agent */ },
};
```

## Forensics Service

```typescript
export async function getForensicsReport(meeseeksId: string) {
  return {
    meeseeks: await meeseeksService.get(meeseeksId),
    messages: await messageService.getHistory(meeseeksId),
    events: await eventService.getEvents(meeseeksId),
    cost: await costService.getForMeeseeks(meeseeksId),
    children: await meeseeksService.getChildren(meeseeksId),
    stressTimeline: await stressService.getTimeline(meeseeksId),
  };
}
```

## PubSub Service

Event emitter interno para comunicación entre componentes:

```typescript
import { EventEmitter } from 'events';

export const pubsub = new EventEmitter();

// Uso
pubsub.emit('meeseeks:spawned', meeseeks);
pubsub.on('meeseeks:spawned', (m) => wsServer.broadcast(m));
```

## Ver También
- [[Managers]] - Managers que usan estos services
- [[API Endpoints]] - Endpoints que exponen services
- [[Sistema de Scoring]] - Lógica en sandbox

## Tags
#services #backend #logic

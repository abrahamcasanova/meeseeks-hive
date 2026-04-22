# Managers

> Controladores del flujo principal del sistema

## Overview

Los managers son singletons que controlan diferentes aspectos del ciclo de vida:

```
┌──────────────────┐
│ Autonomous Mgr   │ ← Loop principal (8s)
├──────────────────┤
│ Lifecycle Mgr    │ ← Monitoreo (3s)
├──────────────────┤
│ Spawn Mgr        │ ← Creación on-demand
├──────────────────┤
│ Strategy Mgr     │ ← Selección on-demand
├──────────────────┤
│ Competition Mgr  │ ← Carreras on-demand
└──────────────────┘
```

## Autonomous Manager

**Archivo**: `backend/src/managers/autonomous.manager.ts`

El corazón del sistema. Ejecuta el loop de iteraciones:

```typescript
export function start() {
  setInterval(tick, 8000);
}

async function tick() {
  const alive = await meeseeksService.getAlive();
  for (const m of alive) {
    await runIteration(m);
  }
}
```

### Flujo de Iteración

1. **Check iteration count** → max 5 iteraciones
2. **Run baseline** → solo en iter 1 (ver [[Baseline]])
3. **Select environment** → easy, medium, random, hard, chaos
4. **Build prompt** → con historial y feedback
5. **Call LLM** → genera código
6. **Execute in sandbox** → ver [[Services#Sandbox]]
7. **Evaluate** → ver [[Sistema de Scoring]]
8. **Update memory** → ver [[Services#Strategy Memory]]
9. **Send feedback** → al LLM para siguiente iteración

### Funciones Clave

| Función | Propósito |
|---------|-----------|
| `runIteration()` | Ejecuta una iteración completa |
| `runBaseline()` | Ejecuta baseline en 5 entornos |
| `getReport()` | Genera reporte de performance |

### Report Structure

```typescript
{
  table: [{
    iteration: number,
    env: string,
    strategy: string,
    requests: number,
    retries: number,
    time_ms: number,
    score: number
  }],
  baseline: { scores, avg, failures },
  system: { avg, failures },
  comparison: { improvement, meetsTarget }
}
```

## Lifecycle Manager

**Archivo**: `backend/src/managers/lifecycle.manager.ts`

Monitorea la salud de los agentes:

```typescript
setInterval(async () => {
  const dying = await meeseeksService.getDying();
  for (const m of dying) {
    // Check if should die
    if (shouldDie(m)) {
      await meeseeksService.kill(m.id, reason);
    }
  }
}, 3000);
```

### Causas de Muerte

- **Max iterations reached** → 5 iteraciones completadas
- **Task completed** → Score = 10 en última iteración
- **Stress exceeded** → stress > 100
- **Manual kill** → Usuario lo destruye
- **Race lost** → Perdió contra otro agente

## Spawn Manager

**Archivo**: `backend/src/managers/spawn.manager.ts`

Crea nuevos Meeseeks:

```typescript
export async function spawn(input: {
  task: string;
  model?: string;
  parentId?: string;
  role?: 'worker' | 'manager';
}) {
  const meeseeks = await meeseeksService.create(input);
  pubsub.emit('meeseeks:spawned', meeseeks);
  return meeseeks;
}
```

### Herencia de Estrategia

Si tiene `parentId`, hereda la estrategia del padre:
```typescript
if (parentId) {
  const parent = await meeseeksService.get(parentId);
  if (parent.strategy) {
    meeseeks.strategy = parent.strategy;
  }
}
```

## Strategy Manager

**Archivo**: `backend/src/managers/strategy.manager.ts`

Selecciona la mejor estrategia para cada iteración:

```typescript
export function selectStrategy(meeseeksId: string, env: string) {
  const memory = strategyMemory.get(meeseeksId);
  
  // Buscar mejor estrategia para este entorno
  const best = memory.findBest(env);
  
  return {
    action: best ? 'reuse' : 'adapt',
    strategy: best?.name,
    reason: best ? `Best for ${env}` : 'First iteration'
  };
}
```

## Competition Manager

**Archivo**: `backend/src/managers/competition.manager.ts`

Maneja carreras entre agentes:

```typescript
export async function startRace(task: string) {
  const competitor1 = await spawnManager.spawn({ task });
  const competitor2 = await spawnManager.spawn({ task });
  
  pubsub.emit('race:started', {
    competitors: [competitor1.id, competitor2.id],
    task
  });
  
  // Monitor until one wins
  return watchRace(competitor1.id, competitor2.id);
}
```

## Ver También
- [[Services]] - Services que usan los managers
- [[Arquitectura Overview]] - Contexto general
- [[API Endpoints]] - Endpoints que llaman managers

## Tags
#managers #backend #core

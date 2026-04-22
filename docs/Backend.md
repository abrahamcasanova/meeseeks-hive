# Backend

> Node.js + TypeScript + Express + Pino

## Estructura

```
backend/src/
├── index.ts           → Entry point, Express app
├── config.ts          → Variables de entorno
├── adapters/          → [[Adapters LLM]]
├── managers/          → [[Managers]]
├── services/          → [[Services]]
├── routes/v1/         → [[API Endpoints]]
├── websocket/         → [[WebSocket Events]]
├── models/            → TypeScript interfaces
├── middleware/        → Error handling, validation
└── db/                → PostgreSQL pool + migrations
```

## Archivos Clave

### `index.ts`
Entry point que:
- Configura Express con CORS
- Monta rutas en `/api/v1`
- Inicia managers (autonomous, lifecycle, competition)
- Inicia WebSocket server en :3002

### `config.ts`
```typescript
export const config = {
  PORT: process.env.PORT || 3001,
  DATABASE_URL: process.env.DATABASE_URL,
  LLM_ADAPTER: process.env.LLM_ADAPTER || 'claude',
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
  // ...
};
```

## Managers

Los managers controlan el flujo del sistema:

| Manager | Responsabilidad | Intervalo |
|---------|----------------|-----------|
| [[Managers#Autonomous Manager\|autonomous]] | Loop principal de iteración | 8s |
| [[Managers#Lifecycle Manager\|lifecycle]] | Monitoreo de vida/muerte | 3s |
| [[Managers#Spawn Manager\|spawn]] | Creación de Meeseeks | on-demand |
| [[Managers#Strategy Manager\|strategy]] | Selección de estrategias | on-demand |
| [[Managers#Competition Manager\|competition]] | Carreras entre agentes | on-demand |

## Services

| Service | Función |
|---------|---------|
| [[Services#Sandbox\|sandbox]] | Ejecuta código en entorno aislado |
| [[Services#Meeseeks\|meeseeks]] | CRUD de agentes |
| [[Services#Evaluator\|evaluator]] | Evalúa calidad del código |
| [[Services#Strategy Memory\|strategy-memory]] | Memoria de estrategias |
| message | Historial de conversación |
| event | Registro de eventos |
| cost | Tracking de tokens/costos |

## Logging

Usa **Pino** para logging estructurado:

```typescript
import pino from 'pino';
const logger = pino({ name: 'autonomous' });

logger.info({ id: meeseeks.id, score: 10 }, 'Iteration complete');
```

Output:
```json
{"level":30,"time":1776701988203,"name":"autonomous","id":"f7bc7a74","score":10,"msg":"Iteration complete"}
```

## Ver También
- [[Arquitectura Overview]]
- [[Managers]] - Detalle de cada manager
- [[Services]] - Detalle de cada service
- [[API Endpoints]] - REST API

## Tags
#backend #node #typescript

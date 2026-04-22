# Arquitectura Overview

> Vista general del sistema Meeseeks Hive

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Backend | Node.js + TypeScript + Express + Pino |
| Frontend | React + Vite + Zustand + Cytoscape |
| Database | PostgreSQL |
| LLM | Claude / Bedrock / Ollama |
| Monorepo | pnpm workspaces |

## Flujo Principal

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Usuario   │────▶│   Backend   │────▶│     LLM     │
│   (POST)    │     │  (Express)  │     │  (Claude)   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                    ┌─────▼─────┐
                    │  Sandbox  │
                    │ (vm2/eval)│
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │ Evaluator │
                    │  (Score)  │
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │  Database │
                    │ (Postgres)│
                    └───────────┘
```

## Estructura de Directorios

```
meeseeks-hive/
├── backend/src/
│   ├── adapters/      → [[Adapters LLM]]
│   ├── managers/      → [[Managers]]
│   ├── services/      → [[Services]]
│   ├── routes/        → [[API Endpoints]]
│   └── websocket/     → [[WebSocket Events]]
│
├── frontend/src/
│   ├── components/    → [[Frontend]]
│   ├── stores/        → Zustand state
│   └── services/      → API clients
│
└── docker/            → PostgreSQL init
```

## Ciclo de Vida de un Meeseeks

1. **Spawn** → [[Managers#Spawn Manager|spawn.manager.ts]] crea el agente
2. **Baseline** → Ejecuta implementación naive para comparar
3. **Iterate** → [[Managers#Autonomous Manager|autonomous.manager.ts]] ejecuta 5 iteraciones:
   - LLM genera código
   - [[Services#Sandbox|sandbox.service.ts]] ejecuta en entorno controlado
   - [[Sistema de Scoring]] evalúa resultado
   - Feedback se envía al LLM
4. **Death** → [[Managers#Lifecycle Manager|lifecycle.manager.ts]] termina el agente

## Comunicación

- **REST API** → CRUD de Meeseeks, mensajes, reportes
- **WebSocket** → Updates en tiempo real (stress, scores, eventos)
- **Database** → Persistencia de estado y métricas

## Ver También
- [[Backend]] - Detalles del servidor
- [[Frontend]] - Detalles del cliente
- [[Database]] - Schema de PostgreSQL

## Tags
#arquitectura #overview

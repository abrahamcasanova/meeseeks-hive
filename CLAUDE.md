# Meeseeks Hive

> Sistema de agentes AI autónomos que reciben tareas, generan código, lo ejecutan en sandbox, y evolucionan sus estrategias basándose en feedback.

**📚 Documentación completa**: Ver carpeta `docs/` (compatible con Obsidian)

## Quick Reference

```bash
# Desarrollo
pnpm dev                    # Backend :3001, Frontend :5173, WS :3002

# Crear agente
curl -X POST localhost:3001/api/v1/meeseeks \
  -H "Content-Type: application/json" \
  -d '{"task":"Write fetchWithRetry(url) - export as module.exports"}'

# Ver reporte
curl localhost:3001/api/v1/meeseeks/{id}/report
```

## Estado del MVP (Verificado ✅)

| Criterio | Resultado |
|----------|-----------|
| Consistencia | 3 runs idénticos ✅ |
| Penalización | req=1→10, req=2→8, req=3→6 ✅ |
| Score óptimo | iter 1,3 con score=10 ✅ |
| Estabilidad | 0 failures ✅ |
| vs Baseline | +61.5% improvement ✅ |

## Sistema de Scoring v4

```javascript
if (success) {
  requests === 1 → score = 10
  requests === 2 → score = 8
  requests === 3 → score = 6
  requests >= 4  → score = 4
} else {
  score = 2
}
```

## Entornos Determinísticos

| Iter | Entorno | Fallos | Max Score |
|------|---------|--------|-----------|
| 1 | easy | 0 | 10 |
| 2 | medium | 1 | 8 |
| 3 | random | 0 | 10 |
| 4 | hard | 2 | 6 |
| 5 | chaos | 1 | 8 |

## Documentación Detallada

La carpeta `docs/` contiene documentación completa en formato Obsidian:

- **Meeseeks Hive.md** → MOC (Map of Content)
- **Arquitectura Overview.md** → Vista general del sistema
- **Sistema de Scoring.md** → Evaluación de código
- **Performance Dashboard.md** → UI de métricas
- **Comandos Útiles.md** → CLI y scripts
- **Debugging.md** → Errores comunes

Abrir `docs/` en Obsidian para ver el grafo de conexiones.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Node.js + TypeScript + Express |
| Frontend | React + Vite + Zustand + Cytoscape |
| DB | PostgreSQL |
| LLM | Claude / Bedrock / Ollama |

## Archivos Clave

```
backend/src/
├── managers/autonomous.manager.ts  → Loop principal
├── services/sandbox.service.ts     → Ejecución + scoring
└── adapters/claude.adapter.ts      → Conexión LLM

frontend/src/
├── components/performance/         → Dashboard de métricas (NEW)
├── components/hive/                → Grafo de agentes
└── components/meeseeks/            → Panel lateral
```

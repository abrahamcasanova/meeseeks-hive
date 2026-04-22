# Meeseeks Hive

> Sistema de agentes AI autónomos que reciben tareas, generan código, lo ejecutan en sandbox, y evolucionan sus estrategias basándose en feedback.

Inspirado en los Mr. Meeseeks de Rick and Morty - existen para completar una tarea y "mueren" al terminar.

## 🗺️ Mapa de Contenido

### Arquitectura
- [[Arquitectura Overview]] - Vista general del sistema
- [[Backend]] - Node.js + TypeScript + Express
- [[Frontend]] - React + Vite + Zustand
- [[Database]] - PostgreSQL schema

### Sistema de Evaluación
- [[Sistema de Scoring]] - Cómo se evalúa el código
- [[Baseline]] - Implementación naive de referencia
- [[Entornos de Prueba]] - easy, medium, hard, random, chaos

### Componentes
- [[Managers]] - autonomous, lifecycle, spawn, strategy
- [[Services]] - sandbox, meeseeks, evaluator, strategy-memory
- [[Adapters LLM]] - Claude, Bedrock, Ollama

### API
- [[API Endpoints]] - REST API completa
- [[WebSocket Events]] - Eventos en tiempo real

### UI
- [[Performance Dashboard]] - Métricas y visualización
- [[Hive Graph]] - Grafo de agentes con Cytoscape

### Desarrollo
- [[Comandos Útiles]] - Scripts y CLI
- [[Debugging]] - Errores comunes y soluciones
- [[Configuración]] - Variables de entorno

## 📊 Estado Actual del MVP

### Criterios Verificados ✅
| Criterio | Estado | Resultado |
|----------|--------|-----------|
| Consistencia | ✅ | 3 runs idénticos |
| Penalización | ✅ | req=1→10, req=2→8, req=3→6 |
| Óptimo | ✅ | iter 1 y 3 con score=10 |
| Estabilidad | ✅ | 0 failures |
| vs Baseline | ✅ | +61.5% improvement |

### Últimos Resultados
```
iter | req | score
1    | 1   | 10
2    | 2   | 8
3    | 1   | 10
4    | 3   | 6
5    | 2   | 8

baseline_avg: 5.2
system_avg: 8.4
```

## 🔗 Quick Links

- [[Arquitectura Overview|Arquitectura]] → Entender el sistema
- [[Sistema de Scoring|Scoring]] → Cómo funciona la evaluación
- [[Performance Dashboard|Dashboard]] → Ver resultados en UI
- [[Comandos Útiles|Comandos]] → Empezar a desarrollar

## Tags
#moc #overview #meeseeks

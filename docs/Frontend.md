# Frontend

> React + Vite + Zustand + Cytoscape

## Estructura

```
frontend/src/
├── App.tsx            → Layout principal
├── main.tsx           → Entry point
├── index.css          → Tailwind styles
├── components/
│   ├── hive/          → [[Hive Graph]]
│   ├── meeseeks/      → Panel lateral
│   ├── performance/   → [[Performance Dashboard]]
│   ├── forensics/     → Análisis post-mortem
│   ├── competition/   → Race banner
│   └── cost/          → Cost badge
├── stores/            → Zustand state
├── hooks/             → Custom hooks
├── services/          → API clients
└── types/             → TypeScript types
```

## Componentes Principales

### Layout (`App.tsx`)
```
┌─────────────────────────────────────────────┐
│  Header (Meeseeks Hive + CostBadge)         │
├─────────────────────────┬───────────────────┤
│                         │                   │
│     HiveGraph           │   MeeseeksPanel   │
│    (Cytoscape)          │   (tabs: perf,    │
│                         │    chat, info,    │
│   + HiveControls        │    events)        │
│   + RaceBanner          │                   │
│   + HiveLegend          │                   │
│                         │                   │
└─────────────────────────┴───────────────────┘
```

### HiveGraph
Visualización del enjambre usando **Cytoscape.js**:
- Nodos = Meeseeks (color por estado)
- Edges = Parent-child relationships
- Click = Seleccionar agente

### MeeseeksPanel
Panel lateral con tabs:
- **perf** → [[Performance Dashboard]] (default)
- **chat** → Historial de mensajes
- **info** → Metadata del agente
- **events** → Timeline de eventos
- **forensics** → Post-mortem (solo si muerto)

### Performance Dashboard
Ver [[Performance Dashboard]] para detalles completos.

## State Management (Zustand)

### `hive.store.ts`
```typescript
interface HiveState {
  meeseeks: Map<string, Meeseeks>;
  selectedId: string | null;
  isConnected: boolean;
  messages: Map<string, Message[]>;
  races: Map<string, RaceInfo>;
}
```

### `cost.store.ts`
```typescript
interface CostState {
  global: CostSummary | null;
}
```

## Hooks

| Hook | Función |
|------|---------|
| `useWebSocket` | Conexión WS y manejo de eventos |
| `useCytoscape` | Integración con grafo |
| `useForensics` | Data para análisis post-mortem |
| `useStreamMessage` | Streaming de respuestas LLM |

## API Services

```typescript
// meeseeks.api.ts
createMeeseeks({ task: string })
getMeeseeks(id: string)
killMeeseeks(id: string)
getPerformanceReport(id: string)  // ← NEW
sendMessage(id: string, content: string)
```

## Styling

- **Tailwind CSS** para estilos
- Tema dark (gray-950 background)
- Colores semánticos:
  - cyan-400 → primary/links
  - green-400 → success/alive
  - red-400 → error/dead
  - yellow-400 → warning/best

## Ver También
- [[Performance Dashboard]] - Dashboard de métricas
- [[Hive Graph]] - Grafo del enjambre
- [[WebSocket Events]] - Eventos en tiempo real

## Tags
#frontend #react #ui

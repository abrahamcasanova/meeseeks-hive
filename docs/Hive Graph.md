# Hive Graph

> Visualización del enjambre de agentes con Cytoscape.js

## Overview

El HiveGraph muestra todos los Meeseeks como nodos en un grafo interactivo:

```
       ┌───┐
       │ M │ ← Manager (púrpura)
       └─┬─┘
    ┌────┼────┐
    ▼    ▼    ▼
  ┌───┐┌───┐┌───┐
  │ W ││ W ││ W │ ← Workers
  └───┘└───┘└───┘
   🟢   🟡   🔴
  alive dying dead
```

## Componentes

### HiveGraph

**Archivo**: `frontend/src/components/hive/HiveGraph.tsx`

```typescript
import Cytoscape from 'cytoscape';
import { useCytoscape } from '../../hooks/useCytoscape';

export function HiveGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { cy } = useCytoscape(containerRef);
  
  return <div ref={containerRef} className="w-full h-full" />;
}
```

### HiveControls

Controles flotantes sobre el grafo:

```
┌─────────────────────────┐
│ [+ Spawn] [⚔ Race]     │
│ [🗑 Kill All]           │
└─────────────────────────┘
```

**Archivo**: `frontend/src/components/hive/HiveControls.tsx`

### HiveLegend

Leyenda de colores:

```
● Alive  ● Dying  ● Dead
● Winner ● Loser  ◆ Manager
```

**Archivo**: `frontend/src/components/hive/HiveLegend.tsx`

### SpawnDialog

Modal para crear nuevos Meeseeks:

```
┌─────────────────────────────┐
│ Spawn Meeseeks              │
├─────────────────────────────┤
│ Task: [_________________]   │
│ Model: [Claude Sonnet ▼]    │
│                             │
│      [Cancel] [Spawn]       │
└─────────────────────────────┘
```

**Archivo**: `frontend/src/components/hive/SpawnDialog.tsx`

## Cytoscape Setup

### useCytoscape Hook

**Archivo**: `frontend/src/hooks/useCytoscape.ts`

```typescript
export function useCytoscape(containerRef: RefObject<HTMLDivElement>) {
  const [cy, setCy] = useState<Cytoscape.Core | null>(null);
  const meeseeks = useHiveStore(s => s.meeseeks);
  const setSelected = useHiveStore(s => s.setSelected);

  useEffect(() => {
    const instance = Cytoscape({
      container: containerRef.current,
      style: [...],
      layout: { name: 'fcose' }
    });
    
    instance.on('tap', 'node', (e) => {
      setSelected(e.target.id());
    });
    
    setCy(instance);
  }, []);

  // Sync nodes with meeseeks state
  useEffect(() => {
    if (!cy) return;
    
    meeseeks.forEach((m, id) => {
      // Add or update node
    });
  }, [cy, meeseeks]);
}
```

### Node Styles

```typescript
const styles = [
  {
    selector: 'node',
    style: {
      'background-color': (node) => {
        const status = node.data('status');
        if (status === 'alive') return '#4ade80';  // green
        if (status === 'dying') return '#fb923c';  // orange
        return '#6b7280';  // gray
      },
      'label': (node) => `#${node.id().slice(0, 6)}`,
      'width': 40,
      'height': 40
    }
  },
  {
    selector: 'node[role="manager"]',
    style: {
      'shape': 'diamond',
      'background-color': '#a855f7'  // purple
    }
  },
  {
    selector: 'edge',
    style: {
      'line-color': '#374151',
      'target-arrow-shape': 'triangle'
    }
  }
];
```

### Layout

Usando **fcose** (force-directed compound spring embedder):

```typescript
const layout = {
  name: 'fcose',
  animate: true,
  randomize: false,
  fit: true,
  padding: 50
};
```

## Interacciones

| Acción | Resultado |
|--------|-----------|
| Click en nodo | Selecciona Meeseeks, abre panel |
| Click en vacío | Deselecciona |
| Drag nodo | Mueve el nodo |
| Scroll | Zoom in/out |
| Drag canvas | Pan |

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌───────────┐
│  WebSocket  │────▶│  HiveStore  │────▶│ Cytoscape │
│  events     │     │  (meeseeks) │     │  (nodes)  │
└─────────────┘     └─────────────┘     └───────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  selectedId │───▶ MeeseeksPanel
                    └─────────────┘
```

## WebSocket Updates

Cuando llega un evento, se actualiza el store y Cytoscape re-renderiza:

```typescript
// useWebSocket.ts
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  
  switch (type) {
    case 'meeseeks:spawned':
      setMeeseeks(data);  // → nuevo nodo
      break;
    case 'meeseeks:updated':
      updateMeeseeks(data.id, data);  // → actualiza color/label
      break;
    case 'meeseeks:dead':
      updateMeeseeks(data.id, { status: 'dead' });  // → gris
      break;
  }
};
```

## Race Banner

Cuando hay una carrera activa, se muestra un banner:

```
┌─────────────────────────────────────┐
│ ⚔️ RACE: #abc123 vs #def456        │
│    Task: Write fetchWithRetry...    │
└─────────────────────────────────────┘
```

**Archivo**: `frontend/src/components/competition/RaceBanner.tsx`

## Ver También
- [[Frontend]] - Contexto del UI
- [[WebSocket Events]] - Eventos en tiempo real
- [[Performance Dashboard]] - Vista de detalles

## Tags
#ui #graph #visualization #cytoscape

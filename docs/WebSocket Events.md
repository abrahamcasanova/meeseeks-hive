# WebSocket Events

> Comunicación en tiempo real entre backend y frontend

## Conexión

```typescript
// Frontend
const ws = new WebSocket('ws://localhost:3002');

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  // Handle event
};
```

## Eventos del Servidor

### meeseeks:spawned
Cuando se crea un nuevo Meeseeks.

```json
{
  "type": "meeseeks:spawned",
  "data": {
    "id": "uuid",
    "task": "Write fetchWithRetry...",
    "status": "alive",
    "stress": 0
  }
}
```

### meeseeks:updated
Cuando se actualiza un Meeseeks.

```json
{
  "type": "meeseeks:updated",
  "data": {
    "id": "uuid",
    "stress": 25,
    "failed_attempts": 1
  }
}
```

### meeseeks:stress
Actualización específica de stress.

```json
{
  "type": "meeseeks:stress",
  "data": {
    "id": "uuid",
    "stress": 50,
    "label": "anxious"
  }
}
```

Labels de stress:
- `eager` → 0-20
- `concerned` → 21-40
- `anxious` → 41-60
- `stressed` → 61-80
- `panicked` → 81-100

### meeseeks:dying
Cuando un Meeseeks entra en estado dying.

```json
{
  "type": "meeseeks:dying",
  "data": {
    "id": "uuid",
    "reason": "Max iterations reached"
  }
}
```

### meeseeks:dead
Cuando un Meeseeks muere.

```json
{
  "type": "meeseeks:dead",
  "data": {
    "id": "uuid",
    "reason": "Task completed with score 10"
  }
}
```

### message:new
Nuevo mensaje en la conversación.

```json
{
  "type": "message:new",
  "data": {
    "meeseeksId": "uuid",
    "message": {
      "id": "msg-uuid",
      "role": "assistant",
      "content": "Here's the code...",
      "tokens_used": 150
    }
  }
}
```

### cost:update
Actualización de costos globales.

```json
{
  "type": "cost:update",
  "data": {
    "total_tokens": 15000,
    "total_cost": 0.45
  }
}
```

### hive:snapshot
Snapshot completo del estado (al conectar).

```json
{
  "type": "hive:snapshot",
  "data": [
    { "id": "uuid1", "task": "...", "status": "alive" },
    { "id": "uuid2", "task": "...", "status": "dead" }
  ]
}
```

### race:started
Cuando inicia una carrera.

```json
{
  "type": "race:started",
  "data": {
    "parentId": "manager-uuid",
    "competitors": ["uuid1", "uuid2"],
    "task": "Write fetchWithRetry..."
  }
}
```

### race:finished
Cuando termina una carrera.

```json
{
  "type": "race:finished",
  "data": {
    "winnerId": "uuid1",
    "loserId": "uuid2",
    "reason": "Higher score (10 vs 6)"
  }
}
```

## Backend Implementation

```typescript
// backend/src/websocket/ws-server.ts
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3002 });

export function broadcast(type: string, data: any) {
  const message = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Conexión inicial
wss.on('connection', (ws) => {
  // Enviar snapshot
  const snapshot = await meeseeksService.getAll();
  ws.send(JSON.stringify({ type: 'hive:snapshot', data: snapshot }));
});
```

## Frontend Hook

```typescript
// frontend/src/hooks/useWebSocket.ts
export function useWebSocket() {
  const setMeeseeks = useHiveStore(s => s.setMeeseeks);
  const updateMeeseeks = useHiveStore(s => s.updateMeeseeks);
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3002');
    
    ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      
      switch (type) {
        case 'meeseeks:spawned':
          setMeeseeks(data);
          break;
        case 'meeseeks:updated':
          updateMeeseeks(data.id, data);
          break;
        // ...
      }
    };
    
    return () => ws.close();
  }, []);
}
```

## Ver También
- [[API Endpoints]] - REST API
- [[Frontend]] - Consumo de eventos
- [[Backend]] - Emisión de eventos

## Tags
#websocket #realtime #events

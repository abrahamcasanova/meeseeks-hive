# API Endpoints

> REST API completa del sistema

## Base URL

```
http://localhost:3001/api/v1
```

## Meeseeks

### Crear Meeseeks
```http
POST /meeseeks
Content-Type: application/json

{
  "task": "Write fetchWithRetry(url) - export as module.exports",
  "model": "claude-sonnet-4-20250514",  // opcional
  "role": "worker"                  // opcional: worker | manager
}
```

**Response**:
```json
{
  "id": "f7bc7a74-...",
  "task": "Write fetchWithRetry...",
  "status": "alive",
  "role": "worker",
  "model": "claude-sonnet-4-20250514",
  "stress": 0,
  "created_at": "2026-04-20T10:19:48.203Z"
}
```

### Obtener Meeseeks
```http
GET /meeseeks/:id
```

### Listar Activos
```http
GET /meeseeks/active
```

**Response**: Array de Meeseeks

### Matar Meeseeks
```http
DELETE /meeseeks/:id
Content-Type: application/json

{
  "reason": "Destroyed by user"  // opcional
}
```

### Matar Todos
```http
DELETE /meeseeks/all
```

**Response**:
```json
{
  "killed": 3
}
```

### Iniciar Carrera
```http
POST /meeseeks/race
Content-Type: application/json

{
  "task": "Write fetchWithRetry..."
}
```

**Response**:
```json
{
  "parentId": "manager-uuid",
  "competitors": ["uuid1", "uuid2"]
}
```

## Mensajes

### Enviar Mensaje
```http
POST /meeseeks/:id/message
Content-Type: application/json

{
  "content": "Add error handling for timeouts"
}
```

**Response**:
```json
{
  "message": {
    "id": "msg-uuid",
    "role": "assistant",
    "content": "I'll add timeout handling...",
    "tokens_used": 150,
    "cost": 0.0045
  },
  "usage": {
    "inputTokens": 100,
    "outputTokens": 150,
    "cost": 0.0045
  }
}
```

### Obtener Historial
```http
GET /meeseeks/:id/messages?cursor=<cursor>
```

**Response**:
```json
{
  "data": [
    { "id": "...", "role": "user", "content": "..." },
    { "id": "...", "role": "assistant", "content": "..." }
  ],
  "nextCursor": "cursor-value"
}
```

## Eventos

### Obtener Eventos
```http
GET /meeseeks/:id/events
```

**Response**:
```json
[
  {
    "id": 1,
    "event_type": "iteration_complete",
    "payload": { "score": 10, "env": "easy" },
    "created_at": "2026-04-20T..."
  }
]
```

## Performance Report

### Obtener Reporte
```http
GET /meeseeks/:id/report
```

**Response**:
```json
{
  "table": [
    {
      "iter": 1,
      "env": "easy",
      "strategy": "https",
      "requests": 1,
      "retries": 0,
      "time": 97,
      "score": 10
    }
  ],
  "baseline": {
    "scores": [10, 2, 10, 2, 2],
    "avg": 5.2,
    "failures": 3
  },
  "system": {
    "avg": 8.4,
    "failures": 0
  },
  "comparison": {
    "improvement": "61.5%",
    "meetsTarget": true
  }
}
```

## Hijos

### Obtener Hijos
```http
GET /meeseeks/:id/children
```

## Costs

### Costos Globales
```http
GET /costs
```

**Response**:
```json
{
  "total_tokens": 15000,
  "total_input_tokens": 10000,
  "total_output_tokens": 5000,
  "total_cost": 0.45,
  "entries_count": 25
}
```

### Costos de un Meeseeks
```http
GET /costs/:id
```

## Forensics

### Reporte Post-mortem
```http
GET /forensics/:id
```

**Response**:
```json
{
  "meeseeks": { /* Meeseeks object */ },
  "messages": [ /* Message history */ ],
  "events": [ /* Event log */ ],
  "cost": { /* Cost summary */ },
  "children": [ /* Child agents */ ],
  "stressTimeline": [
    { "timestamp": "...", "stress": 25 }
  ],
  "lifespan": 45000
}
```

## Error Responses

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Meeseeks not found"
  }
}
```

| Code | HTTP Status | Descripción |
|------|-------------|-------------|
| NOT_FOUND | 404 | Recurso no existe |
| VALIDATION_ERROR | 400 | Datos inválidos |
| INTERNAL_ERROR | 500 | Error del servidor |

## Ver También
- [[WebSocket Events]] - Eventos en tiempo real
- [[Frontend]] - Consumo de la API
- [[Backend]] - Implementación de rutas

## Tags
#api #rest #endpoints

# Comandos Útiles

> Scripts y comandos CLI para desarrollo

## Setup

```bash
# Clonar e instalar
git clone <repo>
cd meeseeks-hive
pnpm install

# Iniciar PostgreSQL
docker-compose up -d postgres

# Copiar env
cp .env.example .env
# Editar con tu CLAUDE_API_KEY
```

## Desarrollo

```bash
# Iniciar todo (backend + frontend)
pnpm dev

# URLs
# Backend:  http://localhost:3001
# Frontend: http://localhost:5173
# WebSocket: ws://localhost:3002

# Solo backend
cd backend && pnpm dev

# Solo frontend
cd frontend && pnpm dev
```

## API Testing

### Crear Meeseeks
```bash
curl -X POST http://localhost:3001/api/v1/meeseeks \
  -H "Content-Type: application/json" \
  -d '{"task":"Write fetchWithRetry(url) - export as module.exports"}'
```

### Ver Estado
```bash
curl http://localhost:3001/api/v1/meeseeks/<id>
```

### Ver Reporte de Performance
```bash
curl http://localhost:3001/api/v1/meeseeks/<id>/report | python3 -m json.tool
```

### Limpiar Todo
```bash
curl -X DELETE http://localhost:3001/api/v1/meeseeks/all
```

### Iniciar Carrera
```bash
curl -X POST http://localhost:3001/api/v1/meeseeks/race \
  -H "Content-Type: application/json" \
  -d '{"task":"Write fetchWithRetry..."}'
```

## Test Automatizado

Script completo para verificar MVP:

```bash
# Limpiar, crear, esperar 70s, ver reporte
curl -s -X DELETE http://localhost:3001/api/v1/meeseeks/all && \
ID=$(curl -s -X POST http://localhost:3001/api/v1/meeseeks \
  -H "Content-Type: application/json" \
  -d '{"task":"Write fetchWithRetry(url) - export as module.exports"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['id'])") && \
echo "ID: $ID" && \
sleep 70 && \
curl -s http://localhost:3001/api/v1/meeseeks/$ID/report | python3 -m json.tool
```

## Logs

```bash
# Ver logs del servidor (si usas archivo)
tail -f /tmp/meeseeks*.log

# Filtrar por scores
cat /tmp/meeseeks.log | grep -E '"score":'

# Filtrar errores
grep -E "error|Error|ERROR" /tmp/meeseeks.log

# Ver solo iteraciones
grep "Iteration complete" /tmp/meeseeks.log
```

## Docker

```bash
# Subir todo
docker-compose up -d

# Solo Postgres
docker-compose up -d postgres

# Ver logs de Postgres
docker-compose logs -f postgres

# Entrar a psql
docker-compose exec postgres psql -U meeseeks -d meeseeks_hive

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

## SQL Útil

```bash
# Conectar
docker-compose exec postgres psql -U meeseeks -d meeseeks_hive
```

```sql
-- Ver meeseeks activos
SELECT id, status, stress, failed_attempts 
FROM meeseeks WHERE status = 'alive';

-- Historial de un agente
SELECT role, LEFT(content, 50), tokens_used 
FROM messages WHERE meeseeks_id = '<id>' 
ORDER BY created_at;

-- Costos totales
SELECT SUM(cost) as total FROM cost_log;

-- Últimos eventos
SELECT event_type, payload, created_at 
FROM events ORDER BY created_at DESC LIMIT 10;
```

## Troubleshooting

### Puerto en uso
```bash
# Matar procesos en 3001/3002
lsof -ti:3001,3002 | xargs kill -9

# O específico
pkill -f "tsx watch"
pkill -f "vite"
```

### Reiniciar limpio
```bash
pkill -f "tsx watch"; \
pkill -f "vite"; \
lsof -ti:3001,3002 | xargs kill -9; \
sleep 2 && pnpm dev
```

### Ver uso de memoria
```bash
ps aux | grep -E "node|tsx" | grep -v grep
```

## Build

```bash
# Build todo
pnpm build

# Build solo backend
cd backend && pnpm build

# Build solo frontend
cd frontend && pnpm build
```

## Ver También
- [[Configuración]] - Variables de entorno
- [[Debugging]] - Solución de errores
- [[API Endpoints]] - Referencia de API

## Tags
#comandos #cli #desarrollo

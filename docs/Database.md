# Database

> PostgreSQL schema para persistencia

## Conexión

```typescript
// backend/src/db/pool.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

## Schema Principal

### `meeseeks`
```sql
CREATE TABLE meeseeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'alive',  -- alive, dying, dead
  role VARCHAR(20) DEFAULT 'worker',   -- worker, manager
  model VARCHAR(100),
  strategy VARCHAR(100),
  parent_id UUID REFERENCES meeseeks(id),
  spawn_depth INT DEFAULT 0,
  stress FLOAT DEFAULT 0,
  failed_attempts INT DEFAULT 0,
  lost_race BOOLEAN DEFAULT false,
  inherited_strategy_failed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  died_at TIMESTAMP,
  death_reason TEXT,
  total_tokens INT DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0
);
```

### `messages`
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeseeks_id UUID REFERENCES meeseeks(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,  -- user, assistant, system
  content TEXT NOT NULL,
  tokens_used INT DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,
  model VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `events`
```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  meeseeks_id UUID REFERENCES meeseeks(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `cost_log`
```sql
CREATE TABLE cost_log (
  id SERIAL PRIMARY KEY,
  meeseeks_id UUID REFERENCES meeseeks(id) ON DELETE CASCADE,
  operation VARCHAR(50),
  input_tokens INT,
  output_tokens INT,
  cost DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Índices

```sql
CREATE INDEX idx_meeseeks_status ON meeseeks(status);
CREATE INDEX idx_meeseeks_parent ON meeseeks(parent_id);
CREATE INDEX idx_messages_meeseeks ON messages(meeseeks_id);
CREATE INDEX idx_events_meeseeks ON events(meeseeks_id);
```

## Docker Setup

```yaml
# docker-compose.yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: meeseeks
      POSTGRES_PASSWORD: meeseeks
      POSTGRES_DB: meeseeks_hive
    ports:
      - "5432:5432"
    volumes:
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
```

## Queries Comunes

### Meeseeks activos
```sql
SELECT * FROM meeseeks WHERE status = 'alive';
```

### Historial de un agente
```sql
SELECT * FROM messages 
WHERE meeseeks_id = $1 
ORDER BY created_at;
```

### Costos totales
```sql
SELECT 
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(cost) as total_cost
FROM cost_log;
```

## Ver También
- [[Arquitectura Overview]]
- [[Backend]] - Uso del pool
- [[Services]] - Queries en services

## Tags
#database #postgresql #schema

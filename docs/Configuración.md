# Configuración

> Variables de entorno y configuración del sistema

## Archivo `.env`

```bash
# Server
PORT=3001
WS_PORT=3002

# Database
DATABASE_URL=postgres://meeseeks:meeseeks@localhost:5432/meeseeks_hive

# LLM
LLM_ADAPTER=claude  # claude | bedrock | ollama

# Claude (directo)
CLAUDE_API_KEY=sk-ant-api03-...

# Bedrock (AWS)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Ollama (local)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# App
MAX_ITERATIONS=5
TICK_INTERVAL=8000
LIFECYCLE_INTERVAL=3000
```

## Variables por Entorno

### Development (default)

```bash
NODE_ENV=development
PORT=3001
```

### Production

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://user:pass@prod-host:5432/meeseeks_hive
```

## config.ts

**Archivo**: `backend/src/config.ts`

```typescript
export const config = {
  // Server
  PORT: parseInt(process.env.PORT || '3001'),
  WS_PORT: parseInt(process.env.WS_PORT || '3002'),
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 
    'postgres://meeseeks:meeseeks@localhost:5432/meeseeks_hive',
  
  // LLM
  LLM_ADAPTER: process.env.LLM_ADAPTER || 'claude',
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  
  // AWS (Bedrock)
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  
  // Ollama
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama2',
  
  // App behavior
  MAX_ITERATIONS: parseInt(process.env.MAX_ITERATIONS || '5'),
  TICK_INTERVAL: parseInt(process.env.TICK_INTERVAL || '8000'),
  LIFECYCLE_INTERVAL: parseInt(process.env.LIFECYCLE_INTERVAL || '3000'),
  SANDBOX_TIMEOUT: parseInt(process.env.SANDBOX_TIMEOUT || '5000'),
};
```

## LLM Adapters

### Claude (Recomendado)

```bash
LLM_ADAPTER=claude
CLAUDE_API_KEY=sk-ant-api03-...
CLAUDE_MODEL=claude-sonnet-4-20250514
```

Modelos disponibles:
- `claude-sonnet-4-20250514` (default, mejor balance)
- `claude-3-opus-20240229` (más capaz, más caro)
- `claude-3-haiku-20240307` (más rápido, más barato)

### Bedrock

```bash
LLM_ADAPTER=bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

Requiere configurar IAM con permisos de Bedrock.

### Ollama (Desarrollo local)

```bash
LLM_ADAPTER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=codellama
```

Instalar Ollama:
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull codellama
```

## Database

### Docker (Development)

```bash
DATABASE_URL=postgres://meeseeks:meeseeks@localhost:5432/meeseeks_hive
```

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
```

### Cloud (Production)

```bash
# Ejemplo con Supabase
DATABASE_URL=postgres://postgres:password@db.xxx.supabase.co:5432/postgres

# Ejemplo con RDS
DATABASE_URL=postgres://admin:password@mydb.xxx.us-east-1.rds.amazonaws.com:5432/meeseeks
```

## Frontend

El frontend usa Vite y se configura en `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

## Timeouts y Límites

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MAX_ITERATIONS` | 5 | Iteraciones por Meeseeks |
| `TICK_INTERVAL` | 8000 | ms entre ticks del autonomous manager |
| `LIFECYCLE_INTERVAL` | 3000 | ms entre checks del lifecycle |
| `SANDBOX_TIMEOUT` | 5000 | ms timeout de ejecución de código |

## Verificar Configuración

```bash
# Ver variables cargadas
node -e "require('dotenv').config(); console.log(process.env)"

# Verificar adapter
curl http://localhost:3001/api/v1/health
# Debería mostrar el adapter en uso
```

## Seguridad

⚠️ **Nunca commitear `.env` con secrets**

```bash
# .gitignore
.env
.env.local
.env.*.local
```

Para producción, usar:
- AWS Secrets Manager
- Doppler
- 1Password Secrets Automation
- Variables de entorno del hosting

## Ver También
- [[Adapters LLM]] - Configuración de LLMs
- [[Database]] - Schema de PostgreSQL
- [[Comandos Útiles]] - Setup inicial

## Tags
#configuracion #env #setup

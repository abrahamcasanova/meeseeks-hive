# Debugging

> Errores comunes y sus soluciones

## Errores de Compilación

### "Cannot find module 'X'"

**Causa**: Falta dependencia o path incorrecto.

**Solución**:
```bash
pnpm install
# O específico
pnpm add <package>
```

### "__unhandledErrors has already been declared"

**Causa**: Variable declarada múltiples veces en el harness.

**Solución**: En `sandbox.service.ts`, asegurar que `__unhandledErrors` se declara solo una vez al inicio del harness.

### "SyntaxError: Missing catch or finally after try"

**Causa**: Variables declaradas dentro de `setTimeout` pero referenciadas fuera.

**Solución**: Declarar variables en el scope superior antes del `setTimeout`.

## Errores de Runtime

### "EADDRINUSE: address already in use :::3001"

**Causa**: Puerto ya ocupado por otro proceso.

**Solución**:
```bash
# Matar proceso en el puerto
lsof -ti:3001 | xargs kill -9

# O matar todos los procesos relacionados
pkill -f "tsx watch"
pkill -f "node.*backend"
```

### "WebSocket server running on :3002" pero frontend no conecta

**Causa**: CORS o URL incorrecta.

**Solución**: Verificar que frontend usa `ws://localhost:3002` (no `wss://`).

### "Failed to fetch" en frontend

**Causa**: Backend no está corriendo o CORS.

**Solución**:
1. Verificar que backend corre en :3001
2. Verificar CORS en Express:
```typescript
app.use(cors({ origin: 'http://localhost:5173' }));
```

## Errores de Database

### "Connection refused" a PostgreSQL

**Causa**: PostgreSQL no está corriendo.

**Solución**:
```bash
docker-compose up -d postgres
# Esperar 5 segundos
docker-compose logs postgres
```

### "relation 'meeseeks' does not exist"

**Causa**: Tablas no creadas.

**Solución**:
```bash
# Recrear desde init.sql
docker-compose down -v
docker-compose up -d postgres
```

## Errores de LLM

### "Invalid API key"

**Causa**: `CLAUDE_API_KEY` no configurada o inválida.

**Solución**:
```bash
# Verificar .env
cat .env | grep CLAUDE_API_KEY

# Debe empezar con sk-ant-
```

### "Rate limit exceeded"

**Causa**: Demasiadas requests a Claude.

**Solución**: Esperar o usar `LLM_ADAPTER=ollama` para desarrollo local.

### Respuestas vacías del LLM

**Causa**: Prompt muy largo o timeout.

**Solución**: Reducir historial de mensajes o aumentar `max_tokens`.

## Errores del Sandbox

### "Script execution timed out"

**Causa**: Código generado tiene loop infinito.

**Solución**: El timeout de 5s debería manejar esto. Si persiste, revisar el código en los logs.

### Score siempre 0

**Causa**: Código no exporta `module.exports` correctamente.

**Solución**: Verificar prompt pide `module.exports = async function...`

### Score siempre 2 (fallo)

**Causa**: Código no maneja el patrón de fallos del entorno.

**Solución**: Esto es esperado para [[Baseline]]. El sistema adaptativo debería mejorar.

## Debugging Tips

### Ver logs detallados

```bash
# En desarrollo, ver todo
DEBUG=* pnpm dev

# Solo errores
cat /tmp/meeseeks.log | grep -i error
```

### Inspeccionar harness generado

```typescript
// En sandbox.service.ts, agregar temporalmente:
console.log('HARNESS:', harness);
```

### Verificar estado de Meeseeks

```bash
curl http://localhost:3001/api/v1/meeseeks/<id> | python3 -m json.tool
```

### Verificar WebSocket

En browser console:
```javascript
const ws = new WebSocket('ws://localhost:3002');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

### Verificar Database

```bash
docker-compose exec postgres psql -U meeseeks -d meeseeks_hive

\dt  -- listar tablas
SELECT * FROM meeseeks;
```

## Checklist de Debugging

1. ✅ Backend corriendo en :3001?
2. ✅ Frontend corriendo en :5173?
3. ✅ WebSocket en :3002?
4. ✅ PostgreSQL en :5432?
5. ✅ `.env` con `CLAUDE_API_KEY`?
6. ✅ `pnpm install` ejecutado?
7. ✅ Tablas creadas en DB?

## Ver También
- [[Comandos Útiles]] - Scripts de debugging
- [[Configuración]] - Variables de entorno
- [[Arquitectura Overview]] - Para entender el flujo

## Tags
#debugging #errores #troubleshooting

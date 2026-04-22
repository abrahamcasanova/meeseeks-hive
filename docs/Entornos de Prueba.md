# Entornos de Prueba

> Configuración de los entornos que determinan el patrón de fallos

## Los 5 Entornos

| Entorno | Patrón | Fallos | Comportamiento |
|---------|--------|--------|----------------|
| easy | Siempre éxito | 0 | Primera llamada funciona |
| medium | Fallo + éxito | 1 | Segunda llamada funciona |
| hard | 2 fallos + éxito | 2 | Tercera llamada funciona |
| random | Siempre éxito | 0 | Igual que easy (determinístico) |
| chaos | Fallo + éxito | 1 | Igual que medium (determinístico) |

## Función `__shouldFail`

```javascript
function __shouldFail(callNum) {
  if (__env === 'easy') return false;       // Nunca falla
  if (__env === 'medium') return callNum === 1;  // Falla 1ra
  if (__env === 'hard') return callNum <= 2;     // Falla 1ra y 2da
  if (__env === 'random') return false;     // Nunca falla
  return callNum === 1;                     // chaos = falla 1ra
}
```

## Asignación por Iteración

```
Iteración 1 → easy
Iteración 2 → medium
Iteración 3 → random
Iteración 4 → hard
Iteración 5 → chaos
```

Código en `autonomous.manager.ts`:
```typescript
const envs = ['easy', 'medium', 'random', 'hard', 'chaos'];
const env = envs[(count - 1) % envs.length];
```

## Relación con [[Sistema de Scoring]]

| Entorno | Min Requests | Max Score |
|---------|--------------|-----------|
| easy | 1 | 10 |
| random | 1 | 10 |
| medium | 2 | 8 |
| chaos | 2 | 8 |
| hard | 3 | 6 |

## ¿Por qué determinístico?

### Versión anterior (random real)
```javascript
// v3 - NO DETERMINÍSTICO
if (__env === 'random') return Math.random() < 0.5;
if (__env === 'chaos') return Math.random() < 0.3 + iteration * 0.1;
```

**Problema**: El mismo código podía dar scores diferentes en cada run.

### Versión actual (v4)
```javascript
// v4 - DETERMINÍSTICO
if (__env === 'random') return false;
return callNum === 1; // chaos
```

**Beneficio**: 
- Consistencia verificable (criterio 1 del MVP)
- Mismo input → mismo output
- Tests reproducibles

## Ejemplo de Ejecución

### Iter 1 (easy)
```
Call 1: __shouldFail(1) = false → SUCCESS
Result: 1 request, score = 10
```

### Iter 2 (medium)
```
Call 1: __shouldFail(1) = true  → FAIL (retry)
Call 2: __shouldFail(2) = false → SUCCESS
Result: 2 requests, score = 8
```

### Iter 4 (hard)
```
Call 1: __shouldFail(1) = true  → FAIL
Call 2: __shouldFail(2) = true  → FAIL
Call 3: __shouldFail(3) = false → SUCCESS
Result: 3 requests, score = 6
```

## Ver También
- [[Sistema de Scoring]] - Cálculo de scores
- [[Baseline]] - Cómo afecta al baseline
- [[Services#Sandbox]] - Donde se implementa

## Tags
#entornos #testing #determinismo

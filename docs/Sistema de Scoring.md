# Sistema de Scoring

> Cómo se evalúa el código generado por los agentes

## Principio Fundamental

```
Menos requests = Mejor score
```

El sistema premia la **eficiencia**: lograr el objetivo con el mínimo de llamadas a la API.

## Scoring v4 (Actual)

### Fórmula

```javascript
if (gotData) {
  if (requests === 1) score = 10;   // Óptimo
  else if (requests === 2) score = 8;
  else if (requests === 3) score = 6;
  else score = 4;                   // 4+ requests
} else {
  score = 2;                        // Fallo total
}
```

### Tabla de Scores

| Requests | Resultado | Score |
|----------|-----------|-------|
| 1 | Éxito | 10 |
| 2 | Éxito | 8 |
| 3 | Éxito | 6 |
| 4+ | Éxito | 4 |
| N/A | Fallo | 2 |

## Relación con [[Entornos de Prueba]]

Cada entorno define cuántos fallos ocurren antes del éxito:

| Entorno | Fallos | Min Requests | Max Score |
|---------|--------|--------------|-----------|
| easy | 0 | 1 | 10 |
| random | 0 | 1 | 10 |
| medium | 1 | 2 | 8 |
| chaos | 1 | 2 | 8 |
| hard | 2 | 3 | 6 |

## Test Harness

El código se ejecuta en [[Services#Sandbox|sandbox.service.ts]] con un harness que:

1. **Mock de fetch/https** → Simula fallos según el entorno
2. **Rate limit** → Máximo de requests permitidos
3. **Timeout** → 5 segundos max de ejecución
4. **Métricas** → Cuenta requests, retries, tiempo

### Ejemplo de Harness Output
```
iter=1 env=easy reqs=1 fails=0 ok=1 time=97ms
SCORING: +gotData → base 10 | requests=1 → score=10
```

## Evolución del Sistema

### v1 (Binario)
- Score = 0 o 9
- Problema: No había progresión

### v2 (Granular)
- Score = +4 data, +3 retry, +2 budget...
- Problema: Scores muy altos rápidamente

### v3 (Request-based)
- Score basado en # requests
- Problema: Inconsistente con random

### v4 (Determinístico) ← Actual
- Entornos determinísticos
- Scores predecibles
- ✅ 5/5 criterios verificados

## Criterios de Éxito MVP

| Criterio | Descripción | Estado |
|----------|-------------|--------|
| Consistencia | Mismo input → mismo output | ✅ |
| Penalización | req=1→≥9, req=4→≤5 | ✅ |
| Óptimo | Al menos 1 iter con score=10 | ✅ |
| Estabilidad | failures(<5) ≤ 1 | ✅ |
| vs Baseline | system ≥ baseline + 20% | ✅ |

## Ver También
- [[Baseline]] - Implementación de referencia
- [[Entornos de Prueba]] - Configuración de fallos
- [[Services#Sandbox]] - Ejecución del código

## Tags
#scoring #evaluacion #mvp

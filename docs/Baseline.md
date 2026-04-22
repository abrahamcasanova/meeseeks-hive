# Baseline

> Implementación naive de referencia para comparar contra el sistema

## Propósito

El baseline representa lo que haría un **desarrollador sin experiencia**:
- Sin retry logic
- Sin manejo de errores
- Sin optimizaciones

Sirve para demostrar que el sistema adaptativo **supera** esta implementación básica.

## Implementación

```javascript
// Código del baseline (naive - sin retry)
module.exports = async function fetchBaseline(url) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', (e) => reject(e));
  });
};
```

## Características

| Aspecto | Baseline | Sistema |
|---------|----------|---------|
| Retries | ❌ No | ✅ Sí (adapta) |
| Error handling | ❌ Básico | ✅ Robusto |
| Adaptación | ❌ No | ✅ Por iteración |
| Aprendizaje | ❌ No | ✅ Strategy memory |

## Ejecución

El baseline se ejecuta **antes de la primera iteración** del Meeseeks:

```typescript
// autonomous.manager.ts
if (count === 1) {
  await runBaseline(meeseeks.id);
}
```

Se ejecuta en los **5 entornos** (easy, medium, random, hard, chaos) y se promedian los scores.

## Resultados Típicos

```
Baseline scores: [10, 2, 10, 2, 2]
- easy:   10 (no fallos → éxito)
- medium:  2 (1 fallo → sin retry → fallo)
- random: 10 (no fallos → éxito)
- hard:    2 (2 fallos → fallo)
- chaos:   2 (1 fallo → fallo)

Baseline avg: 5.2
Baseline failures: 3
```

## Comparación con Sistema

```
System scores: [10, 8, 10, 6, 8]
- easy:   10 (no fallos)
- medium:  8 (1 fallo + retry → 2 requests)
- random: 10 (no fallos)
- hard:    6 (2 fallos + retry → 3 requests)
- chaos:   8 (1 fallo + retry → 2 requests)

System avg: 8.4
System failures: 0
Improvement: +61.5%
```

## Target

El criterio de éxito es:

```
system_avg ≥ baseline_avg + 20%
```

Con baseline_avg = 5.2, el target es ≥ 6.24

Resultado actual: **8.4** ✅

## Almacenamiento

Los resultados del baseline se guardan en memoria y se exponen en el reporte:

```typescript
// API Response
{
  "baseline": {
    "scores": [10, 2, 10, 2, 2],
    "avg": 5.2,
    "failures": 3
  }
}
```

## Ver También
- [[Sistema de Scoring]] - Cómo se calculan los scores
- [[Entornos de Prueba]] - Los 5 entornos de test
- [[Performance Dashboard]] - Visualización en UI

## Tags
#baseline #evaluacion #comparacion

# Performance Dashboard

> UI para visualizar métricas y resultados del sistema

## Propósito

Responder en **<10 segundos**:

> "¿Este sistema mejora los resultados vs baseline?"

## Componentes

### 1. MetricsHeader

Barra superior con métricas clave:

```
┌──────────────────────────────────────────────────┐
│ ▲ +61.5% vs baseline │ Sys: 8.4 │ BL: 5.2 │ F:0 │
└──────────────────────────────────────────────────┘
```

| Métrica | Descripción |
|---------|-------------|
| Improvement | % mejora vs [[Baseline]] (verde/rojo) |
| System Avg | Promedio del sistema |
| Baseline Avg | Promedio del baseline |
| Failures | Scores < 5 |
| Best | Mejor score alcanzado |

**Archivo**: `frontend/src/components/performance/MetricsHeader.tsx`

### 2. ResultsTable

Tabla principal de resultados:

| Iter | Environment | Strategy | Requests | Score |
|------|-------------|----------|----------|-------|
| 1 | easy | https | **1** | 🟢 10 |
| 2 | medium | https | 2 | 🟡 8 |
| 3 | random | https | **1** | 🟢 10 |
| 4 | hard | https | 3 | 🔴 6 |
| 5 | chaos | https | 2 | 🟡 8 |

Colores de score:
- 🟢 Verde: ≥ 9
- 🟡 Amarillo: 7-8
- 🔴 Rojo: < 7

Requests = 1 se resalta en **negrita verde**.

**Archivo**: `frontend/src/components/performance/ResultsTable.tsx`

### 3. ScoreChart

Gráfico de línea simple:

```
10 ─┐     ●─────●
    │    /
 8 ─┤   ●       ●
    │  /         \
 6 ─┤ /           ●
    │
 0 ─┼─┬──┬──┬──┬──┬─
    1  2  3  4  5
```

- X: Iteración
- Y: Score
- Puntos coloreados según score

**Archivo**: `frontend/src/components/performance/ScoreChart.tsx`

### 4. DecisionPanel

Log de decisiones (últimas 3):

```
Iteration 3 (score: 10)
• Reused strategy: https
• random environment detected

Iteration 4 (score: 6)
• Reused strategy: https
• Adjusted retries: 1 → 2
• hard environment detected
```

**Archivo**: `frontend/src/components/performance/DecisionPanel.tsx`

### 5. BaselineComparison

Comparación side-by-side:

```
┌─────────────┬─────────────┐
│  Baseline   │   System    │
│  (Naive)    │  (Adaptive) │
├─────────────┼─────────────┤
│ Avg: 5.2    │ Avg: 8.4    │
│ Fail: 3     │ Fail: 0     │
└─────────────┴─────────────┘
  ✅ Target met: +61.5%
```

**Archivo**: `frontend/src/components/performance/BaselineComparison.tsx`

## Layout

```
┌────────────────────────────────────────┐
│           MetricsHeader                │
├────────────────────────────────────────┤
│                                        │
│           ResultsTable                 │
│                                        │
├────────────────────────────────────────┤
│           ScoreChart                   │
├───────────────────┬────────────────────┤
│   DecisionPanel   │ BaselineComparison │
└───────────────────┴────────────────────┘
```

## Integración

El dashboard se muestra en el tab "perf" del [[Frontend#MeeseeksPanel|MeeseeksPanel]]:

```typescript
// MeeseeksPanel.tsx
type Tab = 'chat' | 'perf' | 'info' | 'events' | 'forensics';
const [tab, setTab] = useState<Tab>('perf');  // Default

// Content
{tab === 'perf' && <PerformanceDashboard meeseeksId={selectedId} />}
```

## Data Flow

```
┌─────────┐     ┌────────────┐     ┌───────────┐
│  API    │────▶│  useState  │────▶│ Components│
│ /report │     │  (report)  │     │           │
└─────────┘     └────────────┘     └───────────┘
     ▲
     │ fetch every 10s
     │
┌────┴────┐
│ useEffect│
└─────────┘
```

## API Call

```typescript
// meeseeks.api.ts
export function getPerformanceReport(id: string) {
  return apiGet<PerformanceReport>(`/meeseeks/${id}/report`);
}
```

Ver [[API Endpoints#Performance Report]] para estructura de respuesta.

## Types

```typescript
// types/meeseeks.ts
export interface PerformanceReport {
  table: IterationResult[];
  baseline: BaselineResult | null;
  system: SystemResult;
  comparison: {
    improvement: string;
    meetsTarget: boolean;
  };
}

export interface IterationResult {
  iter: number;
  env: Environment;
  strategy: string;
  requests: number;
  retries: number;
  time: number;
  score: number;
}
```

## Ver También
- [[Frontend]] - Contexto general del UI
- [[Sistema de Scoring]] - Cómo se calculan los scores
- [[Baseline]] - Comparación con baseline
- [[API Endpoints#Performance Report]] - API del reporte

## Tags
#ui #dashboard #performance #visualization

import type { IterationResult } from '../../types';

interface Props {
  results: IterationResult[];
}

export function ScoreChart({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 text-center text-gray-500 h-32">
        No data to display
      </div>
    );
  }

  const maxScore = 10;
  const height = 120;
  const padding = 20;

  const points = results.map((r, i) => {
    const x = results.length === 1 ? 50 : (i / (results.length - 1)) * 100;
    const y = height - (r.score / maxScore) * (height - padding * 2) - padding;
    return { x, y, score: r.score, iter: r.iter };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Score Over Iterations</div>
      <div className="relative" style={{ height: `${height}px` }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-600 pr-2">
          <span>10</span>
          <span>5</span>
          <span>0</span>
        </div>

        {/* Chart area */}
        <svg className="w-full h-full ml-6" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1={padding} x2="100" y2={padding} stroke="#374151" strokeDasharray="2,2" />
          <line x1="0" y1={height / 2} x2="100" y2={height / 2} stroke="#374151" strokeDasharray="2,2" />
          <line x1="0" y1={height - padding} x2="100" y2={height - padding} stroke="#374151" strokeDasharray="2,2" />

          {/* Line */}
          <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />

          {/* Points */}
          {points.map((p) => (
            <circle
              key={p.iter}
              cx={p.x}
              cy={p.y}
              r="4"
              fill={p.score >= 9 ? '#4ade80' : p.score >= 7 ? '#facc15' : '#f87171'}
              stroke="#1f2937"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between text-xs text-gray-600 mt-1 ml-6">
          {results.map((r) => (
            <span key={r.iter}>{r.iter}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

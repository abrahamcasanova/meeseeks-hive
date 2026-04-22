interface Props {
  data: Array<{ timestamp: string; stress: number }>;
  createdAt: string;
}

export function StressChart({ data, createdAt }: Props) {
  if (data.length < 2) {
    return <div className="text-xs text-gray-500 p-2">Not enough data for chart</div>;
  }

  const startTime = new Date(createdAt).getTime();
  const width = 300;
  const height = 60;
  const padding = 4;

  const maxTime = Math.max(...data.map(d => new Date(d.timestamp).getTime()));
  const timeRange = maxTime - startTime || 1;

  const points = data.map(d => {
    const x = padding + ((new Date(d.timestamp).getTime() - startTime) / timeRange) * (width - padding * 2);
    const y = height - padding - d.stress * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 80 }}>
      {/* Danger zone background */}
      <rect
        x={padding}
        y={padding}
        width={width - padding * 2}
        height={(height - padding * 2) * 0.3}
        fill="rgba(239, 68, 68, 0.1)"
      />

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(v => (
        <line
          key={v}
          x1={padding}
          y1={height - padding - v * (height - padding * 2)}
          x2={width - padding}
          y2={height - padding - v * (height - padding * 2)}
          stroke="#374151"
          strokeWidth={0.5}
        />
      ))}

      {/* Stress line */}
      <polyline
        points={points}
        fill="none"
        stroke="#ef4444"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Dots */}
      {data.map((d, i) => {
        const x = padding + ((new Date(d.timestamp).getTime() - startTime) / timeRange) * (width - padding * 2);
        const y = height - padding - d.stress * (height - padding * 2);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2}
            fill={d.stress > 0.7 ? '#ef4444' : d.stress > 0.3 ? '#facc15' : '#22d3ee'}
          />
        );
      })}
    </svg>
  );
}

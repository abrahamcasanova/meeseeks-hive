interface Props {
  stress: number;
}

function stressColor(stress: number): string {
  if (stress < 0.3) return 'bg-cyan-400';
  if (stress < 0.7) return 'bg-yellow-400';
  return 'bg-red-500';
}

function stressLabel(stress: number): string {
  if (stress < 0.2) return 'Eager';
  if (stress < 0.4) return 'Concerned';
  if (stress < 0.6) return 'Anxious';
  if (stress < 0.8) return 'Stressed';
  return 'PANICKED';
}

export function StressBar({ stress }: Props) {
  const pct = Math.round(stress * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{stressLabel(stress)}</span>
        <span className="text-gray-500">{pct}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${stressColor(stress)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

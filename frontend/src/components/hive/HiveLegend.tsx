export function HiveLegend() {
  const items = [
    { color: 'bg-cyan-400', label: 'Eager (0-20%)' },
    { color: 'bg-yellow-400', label: 'Concerned (20-40%)' },
    { color: 'bg-orange-400', label: 'Anxious (40-60%)' },
    { color: 'bg-red-500', label: 'Stressed (60-80%)' },
    { color: 'bg-red-700', label: 'Panicked (80-100%)' },
    { color: 'bg-gray-500', label: 'Dead' },
  ];

  return (
    <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur rounded-lg p-3 z-10">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Stress Level</div>
      <div className="space-y-1">
        {items.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-gray-400">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            {label}
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-800">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-purple-500" />
          Manager
        </div>
      </div>
    </div>
  );
}

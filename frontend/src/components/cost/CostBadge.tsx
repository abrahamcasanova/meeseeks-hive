import { useCostStore } from '../../stores/cost.store';
import { DollarSign, RotateCcw } from 'lucide-react';

export function CostBadge() {
  const session = useCostStore((s) => s.session);
  const global = useCostStore((s) => s.global);
  const resetSession = useCostStore((s) => s.resetSession);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 bg-gray-900/80 backdrop-blur px-3 py-1.5 rounded-lg text-sm">
        <DollarSign size={14} className="text-cyan-400" />
        <span className="text-gray-300">${session.total_cost.toFixed(4)}</span>
        <span className="text-gray-600 text-xs">({session.total_tokens}t)</span>
        <button
          onClick={resetSession}
          className="text-gray-600 hover:text-gray-300 transition-colors ml-1"
          title="Reset session cost"
        >
          <RotateCcw size={10} />
        </button>
      </div>
      <div className="flex items-center gap-1.5 bg-gray-900/50 px-2 py-1.5 rounded-lg text-xs text-gray-500">
        <span>${global.total_cost.toFixed(4)}</span>
        <span>total</span>
      </div>
    </div>
  );
}

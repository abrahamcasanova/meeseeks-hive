import type { ForensicsReport } from '../../types/forensics';
import { Skull, Clock, MessageSquare, DollarSign } from 'lucide-react';

interface Props {
  report: ForensicsReport;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function DeathSummary({ report }: Props) {
  const { meeseeks, messages, cost, lifespan } = report;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-3">
        <Skull size={16} className="text-red-400" />
        <span className="text-sm font-medium text-red-300">Death Report</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Clock size={12} />
          <span>Lifespan: <span className="text-gray-200">{formatDuration(lifespan)}</span></span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <MessageSquare size={12} />
          <span>Messages: <span className="text-gray-200">{messages.length}</span></span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <DollarSign size={12} />
          <span>Cost: <span className="text-gray-200">${cost.total_cost.toFixed(4)}</span></span>
        </div>
        <div className="text-gray-400">
          Stress: <span className="text-red-300">{Math.round(meeseeks.stress * 100)}%</span>
        </div>
      </div>

      {meeseeks.death_reason && (
        <div className="mt-2 text-xs text-red-300/80 italic">
          "{meeseeks.death_reason}"
        </div>
      )}
    </div>
  );
}

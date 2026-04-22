import type { PerformanceReport } from '../../types';
import { Check, X } from 'lucide-react';

interface Props {
  report: PerformanceReport;
}

export function BaselineComparison({ report }: Props) {
  const { baseline, system, comparison } = report;

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Baseline vs System</div>

      <div className="grid grid-cols-2 gap-4">
        {/* Baseline */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-2 font-medium">Baseline (Naive)</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Avg Score</span>
              <span className="text-lg font-bold text-gray-400">{baseline?.avg ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Failures</span>
              <span className={`text-lg font-bold ${(baseline?.failures ?? 0) > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {baseline?.failures ?? 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* System */}
        <div className="bg-cyan-900/30 border border-cyan-800 rounded-lg p-3">
          <div className="text-xs text-cyan-400 mb-2 font-medium">System (Adaptive)</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Avg Score</span>
              <span className="text-lg font-bold text-white">{system.avg}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Failures</span>
              <span className={`text-lg font-bold ${system.failures > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {system.failures}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Target Status */}
      <div
        className={`mt-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
          comparison.meetsTarget
            ? 'bg-green-900/30 text-green-400 border border-green-800'
            : 'bg-red-900/30 text-red-400 border border-red-800'
        }`}
      >
        {comparison.meetsTarget ? <Check size={16} /> : <X size={16} />}
        <span>
          {comparison.meetsTarget
            ? `Target met: ${comparison.improvement} improvement`
            : `Target not met: ${comparison.improvement} improvement`}
        </span>
      </div>
    </div>
  );
}

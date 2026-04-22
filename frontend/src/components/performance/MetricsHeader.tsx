import type { PerformanceReport } from '../../types';
import { TrendingUp, TrendingDown, AlertTriangle, Trophy, Target } from 'lucide-react';

interface Props {
  report: PerformanceReport;
}

export function MetricsHeader({ report }: Props) {
  const improvement = parseFloat(report.comparison.improvement);
  const isPositive = improvement > 0;
  const bestScore = Math.max(...report.table.map((r) => r.score), 0);

  return (
    <div className="bg-gray-900 border-b border-gray-800 p-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:flex-wrap">
        {/* Improvement - MOST VISIBLE - First on mobile */}
        <div
          className={`col-span-2 flex items-center gap-2 rounded-lg px-4 py-2 ${
            isPositive ? 'bg-green-900/50 border border-green-700' : 'bg-red-900/50 border border-red-700'
          }`}
        >
          {isPositive ? (
            <TrendingUp size={20} className="text-green-400" />
          ) : (
            <TrendingDown size={20} className="text-red-400" />
          )}
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{report.comparison.improvement}
            </span>
            <span className="text-xs text-gray-500">vs baseline</span>
          </div>
        </div>

        {/* System Average */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
          <Target size={16} className="text-cyan-400" />
          <div>
            <div className="text-[10px] text-gray-500 uppercase">System</div>
            <div className="text-lg font-bold text-white">{report.system.avg}</div>
          </div>
        </div>

        {/* Baseline Average */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
          <div className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center text-[10px]">B</div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Baseline</div>
            <div className="text-lg font-bold text-gray-400">{report.baseline?.avg ?? 'N/A'}</div>
          </div>
        </div>

        {/* Failures */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className={report.system.failures > 0 ? 'text-red-400' : 'text-gray-500'} />
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Failures</div>
            <div className={`text-lg font-bold ${report.system.failures > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {report.system.failures}
            </div>
          </div>
        </div>

        {/* Best Score */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
          <Trophy size={16} className="text-yellow-400" />
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Best</div>
            <div className="text-lg font-bold text-yellow-400">{bestScore}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

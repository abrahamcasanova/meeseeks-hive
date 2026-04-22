import { useEffect, useState } from 'react';
import type { PerformanceReport } from '../../types';
import { getPerformanceReport } from '../../services/meeseeks.api';
import { MetricsHeader } from './MetricsHeader';
import { ResultsTable } from './ResultsTable';
import { ScoreChart } from './ScoreChart';
import { DecisionPanel } from './DecisionPanel';
import { BaselineComparison } from './BaselineComparison';
import { WinnerCode } from './WinnerCode';
import { RefreshCw, BarChart2 } from 'lucide-react';

interface Props {
  meeseeksId: string;
}

export function PerformanceDashboard({ meeseeksId }: Props) {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    try {
      setError(null);
      const data = await getPerformanceReport(meeseeksId);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadReport, 10000);
    return () => clearInterval(interval);
  }, [meeseeksId]);

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <RefreshCw size={20} className="animate-spin mr-2" />
        Loading performance data...
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <BarChart2 size={32} className="mb-2 opacity-50" />
        <p className="text-sm">{error}</p>
        <button
          onClick={loadReport}
          className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!report || report.table.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <BarChart2 size={32} className="mb-2 opacity-50" />
        <p className="text-sm">Waiting for iterations...</p>
        <p className="text-xs text-gray-600 mt-1">Performance data will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Metrics Header - Fixed at top */}
      <MetricsHeader report={report} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Results Table - PRIMARY */}
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Iteration Results</div>
          <ResultsTable results={report.table} />
        </div>

        {/* Chart */}
        <ScoreChart results={report.table} />

        {/* Bottom row: Decision + Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DecisionPanel results={report.table} />
          <BaselineComparison report={report} />
        </div>

        {/* Winner Code */}
        {report.winnerCode && (
          <WinnerCode
            code={report.winnerCode.code}
            strategy={report.winnerCode.strategy}
            score={report.winnerCode.score}
            iteration={report.winnerCode.iteration}
          />
        )}
      </div>
    </div>
  );
}

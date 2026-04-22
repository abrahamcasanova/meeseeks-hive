import type { IterationResult } from '../../types';
import { Lightbulb } from 'lucide-react';

interface Props {
  results: IterationResult[];
}

function getDecisionText(current: IterationResult, previous?: IterationResult): string[] {
  const reasons: string[] = [];

  if (!previous) {
    reasons.push(`Initial strategy: ${current.strategy}`);
    reasons.push(`Environment: ${current.env}`);
    return reasons;
  }

  if (current.strategy === previous.strategy) {
    reasons.push(`Reused strategy: ${current.strategy}`);
    if (current.requests < previous.requests) {
      reasons.push(`Optimized: ${previous.requests} → ${current.requests} requests`);
    }
  } else {
    reasons.push(`Changed strategy: ${previous.strategy} → ${current.strategy}`);
  }

  if (current.retries !== previous.retries) {
    reasons.push(`Adjusted retries: ${previous.retries} → ${current.retries}`);
  }

  reasons.push(`${current.env} environment detected`);

  return reasons;
}

export function DecisionPanel({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 text-center text-gray-500">
        No decisions yet
      </div>
    );
  }

  // Show last 3 iterations
  const recentResults = results.slice(-3);

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider mb-3">
        <Lightbulb size={14} />
        <span>Decision Log</span>
      </div>
      <div className="space-y-3">
        {recentResults.map((r, _idx) => {
          const prevIndex = results.indexOf(r) - 1;
          const prev = prevIndex >= 0 ? results[prevIndex] : undefined;
          const decisions = getDecisionText(r, prev);

          return (
            <div key={r.iter} className="border-l-2 border-cyan-800 pl-3">
              <div className="text-xs text-gray-400 mb-1">
                Iteration {r.iter}
                <span className={`ml-2 ${r.score >= 9 ? 'text-green-400' : r.score >= 7 ? 'text-yellow-400' : 'text-red-400'}`}>
                  (score: {r.score})
                </span>
              </div>
              <ul className="text-xs text-gray-300 space-y-0.5">
                {decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-gray-600">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import type { IterationResult } from '../../types';

interface Props {
  results: IterationResult[];
}

function getScoreColor(score: number): string {
  if (score >= 9) return 'text-green-400 bg-green-900/30';
  if (score >= 7) return 'text-yellow-400 bg-yellow-900/30';
  return 'text-red-400 bg-red-900/30';
}

function getEnvBadgeColor(env: string): string {
  switch (env) {
    case 'easy':
      return 'bg-green-800 text-green-300';
    case 'medium':
      return 'bg-yellow-800 text-yellow-300';
    case 'random':
      return 'bg-purple-800 text-purple-300';
    case 'hard':
      return 'bg-orange-800 text-orange-300';
    case 'chaos':
      return 'bg-red-800 text-red-300';
    default:
      return 'bg-gray-800 text-gray-300';
  }
}

export function ResultsTable({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 text-center text-gray-500">
        No iterations yet
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
            <th className="px-4 py-3 text-left">Iter</th>
            <th className="px-4 py-3 text-left">Environment</th>
            <th className="px-4 py-3 text-left">Strategy</th>
            <th className="px-4 py-3 text-center">Requests</th>
            <th className="px-4 py-3 text-center">Score</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={row.iter} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="px-4 py-3 font-mono text-gray-300">{row.iter}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getEnvBadgeColor(row.env)}`}>
                  {row.env}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-300 font-mono text-xs max-w-[130px] truncate" title={row.strategy}>{row.strategy}</td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`font-mono ${
                    row.requests === 1 ? 'text-green-400 font-bold' : 'text-gray-400'
                  }`}
                >
                  {row.requests}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`px-3 py-1 rounded font-bold ${getScoreColor(row.score)}`}
                  title={row.reason}
                >
                  {row.score}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

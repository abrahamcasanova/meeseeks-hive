import { useHiveStore } from '../../stores/hive.store';
import { Trophy, Skull, Swords } from 'lucide-react';

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const color = score >= 8 ? 'bg-green-500' : score >= 5 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1 mt-1">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums w-5 text-right" style={{ color: score >= 8 ? '#4ade80' : score >= 5 ? '#facc15' : '#f87171' }}>
        {score}
      </span>
    </div>
  );
}

export function RaceBanner() {
  const races = useHiveStore((s) => s.races);
  const meeseeks = useHiveStore((s) => s.meeseeks);

  // Show only races where at least one competitor is still alive or recently finished
  const activeRaces = Array.from(races.values()).filter((race) => {
    const allDead = race.competitors.every((id) => {
      const m = meeseeks.get(id);
      return !m || m.status === 'dead';
    });
    if (allDead) return false;
    return true;
  });
  if (activeRaces.length === 0) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex flex-col gap-2">
      {activeRaces.map((race) => {
        const competitors = race.competitors.map(id => meeseeks.get(id)).filter(Boolean);

        if (race.finished && race.winnerId && race.loserId) {
          const winner = meeseeks.get(race.winnerId);
          const loser = meeseeks.get(race.loserId);
          const winScore = race.scores?.[race.winnerId];
          const loseScore = race.scores?.[race.loserId];

          return (
            <div key={race.parentId} className="bg-gray-900/95 backdrop-blur border border-green-700 rounded-xl px-5 py-3 shadow-2xl min-w-96">
              <div className="text-green-400 font-bold text-sm mb-3 flex items-center justify-center gap-2">
                <Trophy size={16} /> RACE FINISHED
              </div>
              <div className="flex items-stretch justify-center gap-3">
                {/* Winner */}
                <div className="flex-1 bg-green-900/20 border border-green-800/40 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Trophy size={11} className="text-green-400" />
                    <span className="text-green-400 font-bold text-xs">WINNER</span>
                  </div>
                  <div className="text-green-300 font-mono text-xs">#{race.winnerId.slice(0, 8)}</div>
                  {winner?.strategy && (
                    <div className="text-gray-400 text-[10px] mt-0.5 truncate max-w-[120px]">{winner.strategy}</div>
                  )}
                  {winScore !== undefined && <ScoreBar score={winScore} />}
                  <div className="text-gray-500 text-[10px] mt-1">{winner?.total_tokens ?? 0} tokens</div>
                </div>

                <div className="flex items-center text-gray-600 font-bold text-base">VS</div>

                {/* Loser */}
                <div className="flex-1 bg-red-900/10 border border-red-900/30 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Skull size={11} className="text-red-400" />
                    <span className="text-red-400 font-bold text-xs">DEFEATED</span>
                  </div>
                  <div className="text-red-300 font-mono text-xs">#{race.loserId.slice(0, 8)}</div>
                  {loser?.strategy && (
                    <div className="text-gray-400 text-[10px] mt-0.5 truncate max-w-[120px]">{loser.strategy}</div>
                  )}
                  {loseScore !== undefined && <ScoreBar score={loseScore} />}
                  <div className="text-gray-500 text-[10px] mt-1">{loser?.total_tokens ?? 0} tokens</div>
                </div>
              </div>
              {race.judgeReason && (
                <p className="text-[10px] text-gray-500 mt-2 text-center truncate max-w-xs mx-auto">
                  {race.judgeReason}
                </p>
              )}
            </div>
          );
        }

        return (
          <div key={race.parentId} className="bg-gray-900/95 backdrop-blur border border-orange-700 rounded-xl px-5 py-3 shadow-2xl min-w-96">
            <div className="text-orange-400 font-bold text-sm mb-1 flex items-center justify-center gap-2 animate-pulse">
              <Swords size={15} /> RACE IN PROGRESS
            </div>
            <p className="text-xs text-gray-400 text-center truncate max-w-sm mb-3">{race.task}</p>
            <div className="flex items-stretch justify-center gap-3">
              {competitors.map((c) => {
                if (!c) return null;
                const iterGuess = Math.max(1, Math.ceil(c.total_tokens / 400));
                return (
                  <div key={c.id} className="flex-1 bg-gray-800 rounded-lg p-2 text-center">
                    <div className="text-cyan-400 font-mono text-xs font-bold">#{c.id.slice(0, 8)}</div>
                    {c.strategy && (
                      <div className="text-gray-400 text-[10px] mt-0.5 truncate">{c.strategy}</div>
                    )}
                    <div className="text-gray-500 text-[10px] mt-1">
                      iter ~{Math.min(iterGuess, 8)} · {c.total_tokens}t · {Math.round(c.stress * 100)}%
                    </div>
                    {/* stress bar as proxy for progress */}
                    <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-orange-500 transition-all"
                        style={{ width: `${Math.min(c.stress * 100 + 10, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { createMeeseeks, startRace, listPlugins, type HarnessPlugin } from '../../services/meeseeks.api';
import { X, Swords, Zap } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function SpawnDialog({ onClose }: Props) {
  const [task, setTask] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'solo' | 'race'>('solo');
  const [harness, setHarness] = useState('js-api');
  const [plugins, setPlugins] = useState<HarnessPlugin[]>([]);

  useEffect(() => {
    listPlugins().then(setPlugins).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task.trim()) return;

    setIsLoading(true);
    try {
      if (mode === 'race') {
        await startRace(task.trim(), harness);
      } else {
        await createMeeseeks({ task: task.trim(), harness });
      }
      onClose();
    } catch (err) {
      console.error('Failed to spawn:', err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-cyan-400">Spawn Meeseeks</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('solo')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'solo'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Zap size={14} />
            Solo
          </button>
          <button
            type="button"
            onClick={() => setMode('race')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'race'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Swords size={14} />
            Race (2 compete)
          </button>
        </div>

        {mode === 'race' && (
          <div className="bg-orange-900/20 border border-orange-800/30 rounded-lg p-2 mb-3 text-xs text-orange-300">
            Two Meeseeks will compete on the same task with different strategies. A judge picks the winner.
          </div>
        )}

        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="What should this Meeseeks do?"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
          rows={3}
          autoFocus
        />

        {/* Harness selector */}
        {plugins.length > 0 && (
          <div className="mt-3">
            <label className="block text-xs text-gray-400 mb-1">Evaluator harness</label>
            <select
              value={harness}
              onChange={(e) => setHarness(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {plugins.map((p) => (
                <option key={p.id} value={p.id} title={p.description}>
                  {p.name}
                </option>
              ))}
            </select>
            {(() => {
              const plugin = plugins.find((p) => p.id === harness);
              if (!plugin) return null;
              return (
                <div className="mt-2 bg-gray-800/60 border border-gray-700/50 rounded-lg p-2.5">
                  <p className="text-xs text-gray-400 mb-1.5">{plugin.description}</p>
                  <div className="flex items-start gap-2">
                    <p className="text-xs text-gray-500 italic flex-1 leading-relaxed">
                      e.g. "{plugin.exampleTask}"
                    </p>
                    <button
                      type="button"
                      onClick={() => plugin.exampleTask && setTask(plugin.exampleTask)}
                      className="shrink-0 text-[10px] px-2 py-1 rounded bg-gray-700 text-cyan-400 hover:bg-gray-600 transition-colors font-medium"
                    >
                      Use
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!task.trim() || isLoading}
            className={`px-4 py-2 text-sm text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === 'race'
                ? 'bg-orange-600 hover:bg-orange-500'
                : 'bg-cyan-600 hover:bg-cyan-500'
            }`}
          >
            {isLoading ? 'Spawning...' : mode === 'race' ? "START RACE!" : "I'M MR. MEESEEKS!"}
          </button>
        </div>
      </form>
    </div>
  );
}


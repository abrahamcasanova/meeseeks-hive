import { useState } from 'react';
import { useHiveStore } from '../../stores/hive.store';
import { killAllMeeseeks } from '../../services/meeseeks.api';
import { SpawnDialog } from './SpawnDialog';
import { SettingsPanel } from './SettingsPanel';
import { Plus, Wifi, WifiOff, Trash2, Settings } from 'lucide-react';

export function HiveControls() {
  const [showSpawn, setShowSpawn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const isConnected = useHiveStore((s) => s.isConnected);
  const meeseeksCount = useHiveStore((s) => s.meeseeks.size);
  const activeCount = useHiveStore((s) => {
    let count = 0;
    for (const m of s.meeseeks.values()) {
      if (m.status !== 'dead' && m.status !== 'dying') count++;
    }
    return count;
  });

  async function handleKillAll() {
    if (meeseeksCount === 0) return;
    await killAllMeeseeks();
    useHiveStore.getState().loadInitialState();
  }

  return (
    <>
      <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
        <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur px-3 py-1.5 rounded-lg text-sm">
          {isConnected ? (
            <Wifi size={14} className="text-green-400" />
          ) : (
            <WifiOff size={14} className="text-red-400" />
          )}
          <span className="text-gray-400">{activeCount} active</span>
        </div>

        {meeseeksCount > 0 && (
          <button
            onClick={handleKillAll}
            className="flex items-center gap-1.5 bg-red-900/80 hover:bg-red-800 text-red-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 size={14} />
            Kill All
          </button>
        )}

        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Settings size={14} />
        </button>

        <button
          onClick={() => setShowSpawn(true)}
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          Spawn
        </button>
      </div>

      {showSpawn && <SpawnDialog onClose={() => setShowSpawn(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  );
}

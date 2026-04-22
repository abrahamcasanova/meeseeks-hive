import { useEffect, useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useHiveStore } from './stores/hive.store';
import { useCostStore } from './stores/cost.store';
import { HiveGraph } from './components/hive/HiveGraph';
import { HiveControls } from './components/hive/HiveControls';
import { MeeseeksPanel } from './components/meeseeks/MeeseeksPanel';
import { CostBadge } from './components/cost/CostBadge';
import { HiveLegend } from './components/hive/HiveLegend';
import { RaceBanner } from './components/competition/RaceBanner';
import { ViewToggle } from './components/hive/ViewToggle';
import { OfficeView } from './components/office/OfficeView';
import { EmptyState } from './components/hive/EmptyState';
import { SpawnDialog } from './components/hive/SpawnDialog';

type ViewMode = 'graph' | 'office';

function RightPanel() {
  const selectedId = useHiveStore((s) => s.selectedId);
  const meeseeks = useHiveStore((s) => (selectedId ? s.meeseeks.get(selectedId) : undefined));

  if (!selectedId || !meeseeks) return null;
  return <MeeseeksPanel />;
}

export function App() {
  useWebSocket();
  const loadInitialState = useHiveStore((s) => s.loadInitialState);
  const loadGlobalCost = useCostStore((s) => s.loadGlobalCost);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [showSpawnFromEmpty, setShowSpawnFromEmpty] = useState(false);
  const isEmpty = useHiveStore((s) => s.meeseeks.size === 0);

  useEffect(() => {
    loadInitialState();
    loadGlobalCost();
  }, [loadInitialState, loadGlobalCost]);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
        <h1 className="text-lg font-bold text-cyan-400">Meeseeks Hive</h1>
        <CostBadge />
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 relative min-w-0">
          {viewMode === 'graph' ? <HiveGraph /> : <OfficeView />}
          {isEmpty && <EmptyState onSpawn={() => setShowSpawnFromEmpty(true)} />}
          <HiveControls />
          <RaceBanner />
          <HiveLegend />
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          {showSpawnFromEmpty && <SpawnDialog onClose={() => setShowSpawnFromEmpty(false)} />}
        </div>
        <RightPanel />
      </div>
    </div>
  );
}

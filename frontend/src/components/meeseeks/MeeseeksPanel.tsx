import { useState } from 'react';
import { useHiveStore } from '../../stores/hive.store';
import { killMeeseeks } from '../../services/meeseeks.api';
import { StressBar } from './StressBar';
import { ChatView } from './ChatView';
import { EventTimeline } from './EventTimeline';
import { ForensicsDrawer } from '../forensics/ForensicsDrawer';
import { PerformanceDashboard } from '../performance/PerformanceDashboard';
import { X, Trash2, Clock, Cpu } from 'lucide-react';

type Tab = 'chat' | 'perf' | 'info' | 'events' | 'forensics';

export function MeeseeksPanel() {
  const selectedId = useHiveStore((s) => s.selectedId);
  const meeseeks = useHiveStore((s) => (selectedId ? s.meeseeks.get(selectedId) : undefined));
  const setSelected = useHiveStore((s) => s.setSelected);
  const [tab, setTab] = useState<Tab>('perf');

  if (!selectedId || !meeseeks) return null;

  const isDead = meeseeks.status === 'dead';
  const age = Math.round((Date.now() - new Date(meeseeks.created_at).getTime()) / 1000);
  const ageLabel = age < 60 ? `${age}s` : `${Math.floor(age / 60)}m ${age % 60}s`;

  const tabs: Tab[] = isDead ? ['perf', 'chat', 'forensics', 'info', 'events'] : ['perf', 'chat', 'info', 'events'];

  async function handleKill() {
    if (!selectedId) return;
    await killMeeseeks(selectedId);
  }

  const panelWidth = tab === 'perf' ? 'w-full sm:w-[560px]' : 'w-full sm:w-96';

  return (
    <div className={`${panelWidth} bg-gray-900 border-l border-gray-800 flex flex-col h-full transition-all`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              meeseeks.status === 'alive' ? 'bg-green-400' :
              meeseeks.status === 'dying' ? 'bg-orange-400 animate-pulse' :
              meeseeks.lost_race ? 'bg-red-500' :
              meeseeks.death_reason?.includes('WON') ? 'bg-green-500' :
              'bg-gray-500'
            }`} />
            <span className="font-mono text-sm text-gray-300">#{selectedId.slice(0, 8)}</span>
            {meeseeks.role === 'manager' && (
              <span className="text-[10px] bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded">MGR</span>
            )}
            {isDead && meeseeks.lost_race && (
              <span className="text-[10px] bg-red-900 text-red-300 px-1.5 py-0.5 rounded">LOST</span>
            )}
            {isDead && meeseeks.death_reason?.includes('WON') && (
              <span className="text-[10px] bg-green-900 text-green-300 px-1.5 py-0.5 rounded">WON</span>
            )}
          </div>
          <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-gray-400 truncate mb-2">{meeseeks.task}</p>
        <StressBar stress={meeseeks.stress} />

        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Clock size={12} />{ageLabel}</span>
          <span className="flex items-center gap-1"><Cpu size={12} />{meeseeks.total_tokens > 0 ? `${meeseeks.total_tokens.toLocaleString()}t` : '…'}</span>
          <span>{meeseeks.total_cost > 0 ? `$${meeseeks.total_cost.toFixed(4)}` : '…'}</span>
        </div>

        {isDead && meeseeks.death_reason && (() => {
          const raw = meeseeks.death_reason;
          const parts = raw.split(' \u2014 stopped: ');
          const stats = parts[0] ?? raw;
          const stopped = parts[1] ?? null;

          // Determine pill color from stop cause or other signals
          const pillCls = meeseeks.lost_race
            ? 'bg-red-900/40 text-red-300 border-red-700/40'
            : raw.includes('WON')
            ? 'bg-green-900/40 text-green-300 border-green-700/40'
            : stopped === 'perfect score'
            ? 'bg-green-900/40 text-green-300 border-green-700/40'
            : stopped === 'token limit reached'
            ? 'bg-orange-900/40 text-orange-300 border-orange-700/40'
            : stopped?.includes('convergence') || stopped?.includes('max iterations')
            ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700/30'
            : raw.includes('Destroyed by user')
            ? 'bg-gray-800 text-gray-400 border-gray-700/40'
            : 'bg-gray-800 text-gray-400 border-gray-700/40';

          return (
            <div className="mt-2 space-y-1">
              {stopped && (
                <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${pillCls}`}>
                  {stopped === 'perfect score' ? '✓ perfect score'
                    : stopped === 'token limit reached' ? '⚡ token limit'
                    : stopped?.includes('convergence') ? '~ convergence'
                    : stopped?.includes('max iterations') ? '⏹ max iterations'
                    : stopped}
                </div>
              )}
              {meeseeks.lost_race && (
                <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${pillCls}`}>
                  💀 lost race
                </div>
              )}
              <p className="text-[11px] text-gray-400 leading-snug">{stats}</p>
            </div>
          );
        })()}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium capitalize ${
              tab === t ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'perf' && <PerformanceDashboard meeseeksId={selectedId} />}
        {tab === 'chat' && <ChatView meeseeksId={selectedId} />}
        {tab === 'forensics' && <ForensicsDrawer />}
        {tab === 'info' && (
          <div className="p-3 space-y-3 text-sm overflow-y-auto">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-500">Status</div>
                <div className="text-gray-200 capitalize">{meeseeks.status}</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-500">Model</div>
                <div className="text-gray-200 text-[10px]">{meeseeks.model}</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-500">Failed Attempts</div>
                <div className="text-gray-200">{meeseeks.failed_attempts}</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-500">Spawn Depth</div>
                <div className="text-gray-200">{meeseeks.spawn_depth}</div>
              </div>
            </div>

            {meeseeks.status === 'alive' && (
              <button
                onClick={handleKill}
                className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs"
              >
                <Trash2 size={12} />
                Destroy Meeseeks
              </button>
            )}
          </div>
        )}
        {tab === 'events' && <EventTimeline meeseeksId={selectedId} />}
      </div>
    </div>
  );
}

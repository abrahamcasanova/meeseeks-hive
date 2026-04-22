import { useState, useEffect } from 'react';
import { getEvents } from '../../services/meeseeks.api';
import type { MeeseeksEvent } from '../../types';

interface Props {
  meeseeksId: string;
}

const EVENT_ICONS: Record<string, string> = {
  spawned: '✨',
  message_sent: '💬',
  message_received: '🤖',
  stress_changed: '📊',
  sub_spawned: '👶',
  memory_injected: '🧠',
  race_lost: '💀',
  dying: '😵',
  dead: '⚰️',
};

function parseDeathReason(raw: string): { stats: string; stopped: string | null } {
  const parts = raw.split(' \u2014 stopped: ');
  return { stats: parts[0] ?? raw, stopped: parts[1] ?? null };
}

export function EventTimeline({ meeseeksId }: Props) {
  const [events, setEvents] = useState<MeeseeksEvent[]>([]);

  useEffect(() => {
    getEvents(meeseeksId).then(setEvents).catch(console.error);
  }, [meeseeksId]);

  return (
    <div className="p-3 space-y-2 overflow-y-auto h-full">
      {events.length === 0 && (
        <p className="text-sm text-gray-500">No events yet</p>
      )}
      {events.map((evt) => {
        const isMemory = evt.event_type === 'memory_injected';
        const isDying = evt.event_type === 'dying';
        const isDead = evt.event_type === 'dead';
        const isStress = evt.event_type === 'stress_changed';
        const isRaceLost = evt.event_type === 'race_lost';

        const strategies = isMemory
          ? (evt.payload.strategies as { name: string; avg: number; wins: number }[] | undefined) ?? []
          : [];

        // Dying / dead: show human-readable reason, not raw JSON
        if (isDying || isDead) {
          const rawReason = (evt.payload.reason as string | undefined) ?? '';
          const { stats, stopped } = parseDeathReason(rawReason);
          const colorCls = isDying
            ? 'bg-orange-900/25 border border-orange-700/40'
            : 'bg-red-900/20 border border-red-700/30';
          const textCls = isDying ? 'text-orange-300' : 'text-red-400';
          return (
            <div key={evt.id} className={`rounded-lg px-2.5 py-2 ${colorCls}`}>
              <div className="flex items-center gap-2 mb-1">
                <span>{EVENT_ICONS[evt.event_type]}</span>
                <span className={`font-mono font-semibold text-sm ${textCls}`}>{evt.event_type}</span>
                <span className="text-gray-500 text-xs ml-auto">{new Date(evt.created_at).toLocaleTimeString()}</span>
              </div>
              <p className={`text-xs ${textCls} leading-snug`}>{stats}</p>
              {stopped && (
                <p className="text-xs text-gray-400 mt-0.5">Stopped: <span className="text-gray-300">{stopped}</span></p>
              )}
            </div>
          );
        }

        return (
          <div
            key={evt.id}
            className={`flex items-start gap-2 text-sm ${isMemory ? 'bg-purple-900/30 border border-purple-700/50 rounded-lg px-2 py-1.5' : ''}`}
          >
            <span className="shrink-0">{EVENT_ICONS[evt.event_type] ?? '📌'}</span>
            <div className="min-w-0 w-full">
              <span className={`font-mono ${isMemory ? 'text-purple-300' : 'text-cyan-400'}`}>
                {evt.event_type}
              </span>
              <span className="text-gray-500 ml-2 text-xs">
                {new Date(evt.created_at).toLocaleTimeString()}
              </span>

              {isMemory && strategies.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {strategies.map((s) => (
                    <div key={s.name} className="text-xs text-purple-200 flex gap-2">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-purple-400">avg={s.avg.toFixed(1)}</span>
                      <span className="text-purple-500">{s.wins} wins</span>
                    </div>
                  ))}
                </div>
              )}

              {isStress && (
                <span className="ml-2 text-xs text-yellow-400 font-mono">
                  {Math.round(((evt.payload.stress as number) ?? 0) * 100)}%
                </span>
              )}

              {isRaceLost && !!evt.payload.reason && (
                <p className="text-xs text-red-400 mt-0.5">{evt.payload.reason as string}</p>
              )}

              {!isMemory && !isStress && !isRaceLost && Object.keys(evt.payload).length > 0 && (
                <pre className="text-xs text-gray-600 mt-0.5 truncate">
                  {JSON.stringify(evt.payload)}
                </pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


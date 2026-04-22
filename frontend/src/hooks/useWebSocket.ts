import { useEffect } from 'react';
import { wsClient } from '../services/websocket';
import { useHiveStore } from '../stores/hive.store';
import { useCostStore } from '../stores/cost.store';
import { getMeeseeks } from '../services/meeseeks.api';
import type { WsEvent } from '../types';

export function useWebSocket() {
  const setMeeseeks = useHiveStore((s) => s.setMeeseeks);
  const updateMeeseeks = useHiveStore((s) => s.updateMeeseeks);
  const addMessage = useHiveStore((s) => s.addMessage);
  const loadSnapshot = useHiveStore((s) => s.loadSnapshot);
  const setConnected = useHiveStore((s) => s.setConnected);
  const addRace = useHiveStore((s) => s.addRace);
  const finishRace = useHiveStore((s) => s.finishRace);
  const markMemoryInjected = useHiveStore((s) => s.markMemoryInjected);
  const setMemoryChain = useHiveStore((s) => s.setMemoryChain);
  const triggerGhost = useHiveStore((s) => s.triggerGhost);
  const updateGlobalCost = useCostStore((s) => s.updateGlobal);

  useEffect(() => {
    wsClient.connect();

    const unsubscribe = wsClient.onEvent((events: WsEvent[]) => {
      for (const event of events) {
        switch (event.type) {
          case 'meeseeks:spawned':
            setMeeseeks(event.data);
            break;
          case 'meeseeks:updated':
            updateMeeseeks(event.data.id, event.data);
            break;
          case 'meeseeks:stress':
            updateMeeseeks(event.data.id, { stress: event.data.stress });
            break;
          case 'meeseeks:dying':
            updateMeeseeks(event.data.id, { status: 'dying', death_reason: event.data.reason });
            break;
          case 'meeseeks:dead':
            updateMeeseeks(event.data.id, { status: 'dead', death_reason: event.data.reason });
            break;
          case 'message:new':
            addMessage(event.data.meeseeksId, event.data.message);
            break;
          case 'cost:update':
            updateGlobalCost(event.data);
            break;
          case 'hive:snapshot':
            loadSnapshot(event.data);
            break;
          case 'race:started':
            addRace({ parentId: event.data.parentId, competitors: event.data.competitors, task: event.data.task, finished: false });
            break;
          case 'meeseeks:memory_injected': {
            markMemoryInjected(event.data.id);
            const sourceId = (event.data.strategies[0] as { sourceId?: string })?.sourceId;
            const ancestry: string[] = (event.data as { ancestry?: string[] }).ancestry ?? [];
            // ancestry[0] = predecesor directo, ancestry[1] = abuelo, etc.
            const fullChain = sourceId ? [sourceId, ...ancestry.filter((id: string) => id !== sourceId)] : ancestry;
            if (fullChain.length > 0) {
              setMemoryChain(event.data.id, fullChain[0]!);
              triggerGhost(event.data.id, fullChain);
            }
            break;
          }
          case 'race:finished': {
            const allRaces = useHiveStore.getState().races;
            for (const [pid, r] of allRaces) {
              if (r.competitors.includes(event.data.winnerId) || r.competitors.includes(event.data.loserId)) {
                finishRace(pid, event.data.winnerId, event.data.loserId, (event.data as { scores?: Record<string, number> }).scores, event.data.reason);
                break;
              }
            }
            updateMeeseeks(event.data.loserId, { lost_race: true });
            getMeeseeks(event.data.winnerId).then(m => setMeeseeks(m)).catch(() => {});
            getMeeseeks(event.data.loserId).then(m => setMeeseeks(m)).catch(() => {});
            break;
          }
        }
      }
    });

    const interval = setInterval(() => {
      setConnected(wsClient.isConnected);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      wsClient.disconnect();
    };
  }, []);
}

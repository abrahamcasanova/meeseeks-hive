import { useRef, useMemo } from 'react';
import type { Meeseeks } from '@/types';
import type { MeeseeksAnimationState } from '@/types/office';

export function useMeeseeksAnimations(
  meeseeksMap: Map<string, Meeseeks>,
): Map<string, MeeseeksAnimationState> {
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  return useMemo(() => {
    const result = new Map<string, MeeseeksAnimationState>();
    const prevStatuses = prevStatusRef.current;

    for (const [id, m] of meeseeksMap) {
      const prev = prevStatuses.get(id);
      const isNew = !prev;

      if (m.status === 'dead') {
        result.set(id, 'dead');
      } else if (m.status === 'dying') {
        result.set(id, 'dying');
      } else if (isNew && m.status === 'alive') {
        // Only spawn animation if genuinely new this session
        result.set(id, 'spawning');
      } else if (m.stress >= 0.6) {
        result.set(id, 'stressed');
      } else {
        result.set(id, 'working');
      }

      prevStatuses.set(id, m.status);
    }

    for (const id of prevStatuses.keys()) {
      if (!meeseeksMap.has(id)) prevStatuses.delete(id);
    }

    return result;
  }, [meeseeksMap]);
}

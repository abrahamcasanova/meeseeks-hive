import { Html } from '@react-three/drei';
import { stressColor } from '@/utils/stressUtils';
import { meeseeksName } from '@/utils/nameUtils';
import type { Vector3Tuple } from 'three';
import type { MeeseeksAnimationState } from '@/types/office';

interface MeeseeksLabelProps {
  meeseeksId: string;
  stress: number;
  position: Vector3Tuple;
  animationState?: MeeseeksAnimationState;
  ancestryCount?: number;
}

export function MeeseeksLabel({ meeseeksId, stress, position, animationState, ancestryCount = 0 }: MeeseeksLabelProps) {
  const isDead = animationState === 'dead' || animationState === 'dying';

  return (
    <Html position={position} center zIndexRange={[10, 0]}>
      {isDead ? (
        <div
          className="pointer-events-none select-none flex items-center gap-1 whitespace-nowrap text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
          style={{
            color: '#9ca3af',
            background: 'rgba(0,0,0,0.65)',
            border: '1px solid #4b5563',
          }}
        >
          💀 {meeseeksName(meeseeksId)} DEAD
        </div>
      ) : (
        <div
          className="pointer-events-none select-none whitespace-nowrap text-[10px] font-mono font-bold px-1 py-0.5 rounded flex items-center gap-1"
          style={{
            color: stressColor(stress),
            textShadow: '0 0 6px rgba(0,0,0,0.9)',
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          {ancestryCount > 0 && (
            <span style={{ color: '#f59e0b', fontSize: '9px' }}>💡{ancestryCount}</span>
          )}
          {meeseeksName(meeseeksId)} {Math.round(stress * 100)}%
        </div>
      )}
    </Html>
  );
}

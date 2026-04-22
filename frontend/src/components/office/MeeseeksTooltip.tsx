import { Html } from '@react-three/drei';
import { stressLabel, stressColor } from '@/utils/stressUtils';
import { meeseeksName } from '@/utils/nameUtils';
import type { Meeseeks } from '@/types';
import type { Vector3Tuple } from 'three';

interface MeeseeksTooltipProps {
  meeseeks: Meeseeks;
  position: Vector3Tuple;
}

export function MeeseeksTooltip({ meeseeks: m, position }: MeeseeksTooltipProps) {
  return (
    <Html position={position} center zIndexRange={[20, 0]}>
      <div className="pointer-events-none select-none bg-gray-900/95 border border-gray-700 rounded-lg px-3 py-2 text-xs w-48 shadow-xl">
        <div className="font-mono text-cyan-400 font-bold mb-1">{meeseeksName(m.id)}</div>
        <div className="text-gray-300 truncate mb-1">{m.task.slice(0, 50)}</div>
        <div className="flex justify-between text-gray-400">
          <span>Status</span>
          <span className={m.status === 'alive' ? 'text-green-400' : 'text-red-400'}>{m.status}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Stress</span>
          <span style={{ color: stressColor(m.stress) }}>{stressLabel(m.stress)} ({Math.round(m.stress * 100)}%)</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Role</span>
          <span className={m.role === 'manager' ? 'text-purple-400' : 'text-gray-300'}>{m.role}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Tokens</span>
          <span className="text-gray-300">{m.total_tokens.toLocaleString()}</span>
        </div>
      </div>
    </Html>
  );
}

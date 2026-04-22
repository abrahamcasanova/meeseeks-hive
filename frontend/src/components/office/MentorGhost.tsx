import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { meeseeksName } from '@/utils/nameUtils';
import type { Vector3Tuple } from 'three';

interface MentorGhostProps {
  sourceId: string;
  position: Vector3Tuple;
  slot?: number; // 0=predecesor, 1=abuelo, 2=bisabuelo — offset lateral
  onDone: () => void;
}

const DURATION = 4.0;

export function MentorGhost({ sourceId, position, slot = 0, onDone }: MentorGhostProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRefs = useRef<THREE.MeshStandardMaterial[]>([]);
  const labelRef = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0);
  const doneFired = useRef(false);

  const [px, , pz] = position;
  // slot 0 = izquierda inmediata, slot 1 = más lejos, slot 2 = aún más
  const ghostX = px - 1.8 - slot * 1.6;
  const ghostZ = pz + 0.7;

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = Math.min(elapsed.current / DURATION, 1);

    const group = groupRef.current;
    if (!group) return;

    group.position.set(ghostX, 0.45 + t * 0.8, ghostZ);

    const opacity = t < 0.15
      ? t / 0.15
      : 1 - ((t - 0.15) / 0.85);
    const clamped = Math.max(0, Math.min(1, opacity));

    for (const mat of matRefs.current) mat.opacity = clamped * 0.55;

    // Sincronizar Html label con el opacity de los meshes
    if (labelRef.current) {
      labelRef.current.style.opacity = String(clamped);
    }

    if (t >= 1 && !doneFired.current) {
      doneFired.current = true;
      onDone();
    }
  });

  const matRef = (mat: THREE.MeshStandardMaterial | null) => {
    if (mat && !matRefs.current.includes(mat)) matRefs.current.push(mat);
  };

  const name = meeseeksName(sourceId);

  return (
    <group ref={groupRef} position={[ghostX, 0.45, ghostZ]}>
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.28, 0.34, 0.2]} />
        <meshStandardMaterial ref={matRef} color="#f59e0b" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.22, 0.22, 0.22]} />
        <meshStandardMaterial ref={matRef} color="#f59e0b" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[-0.2, 0.18, 0]}>
        <boxGeometry args={[0.08, 0.28, 0.1]} />
        <meshStandardMaterial ref={matRef} color="#f59e0b" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0.2, 0.18, 0]}>
        <boxGeometry args={[0.08, 0.28, 0.1]} />
        <meshStandardMaterial ref={matRef} color="#f59e0b" transparent opacity={0} depthWrite={false} />
      </mesh>

      <Html position={[0, 1.05, 0]} center zIndexRange={[10, 0]}>
        <div
          ref={labelRef}
          className="pointer-events-none select-none whitespace-nowrap text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
          style={{
            color: '#f59e0b',
            background: 'rgba(0,0,0,0.7)',
            border: '1px solid #f59e0b55',
            textShadow: '0 0 8px #f59e0b99',
            opacity: 0,
          }}
        >
          💡 {name}
        </div>
      </Html>
    </group>
  );
}

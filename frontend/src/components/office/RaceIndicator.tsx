import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Vector3Tuple } from 'three';

interface RaceIndicatorProps {
  posA: Vector3Tuple;
  posB: Vector3Tuple;
}

export function RaceIndicator({ posA, posB }: RaceIndicatorProps) {
  const lineRef = useRef<THREE.Mesh>(null);

  const midX = (posA[0] + posB[0]) / 2;
  const midZ = (posA[2] + posB[2]) / 2;
  const dx = posB[0] - posA[0];
  const dz = posB[2] - posA[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const midY = 1.2;

  useFrame((state) => {
    if (!lineRef.current) return;
    const pulse = 0.6 + Math.sin(state.clock.elapsedTime * 4) * 0.4;
    (lineRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
  });

  return (
    <group>
      {/* Dashed line between desks */}
      <mesh
        ref={lineRef}
        position={[midX, midY, midZ]}
        rotation={[Math.PI / 2, 0, angle]}
      >
        <cylinderGeometry args={[0.03, 0.03, length, 6]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.8} />
      </mesh>

      {/* VS label in center */}
      <Html position={[midX, midY + 0.6, midZ]} center zIndexRange={[15, 0]}>
        <div className="pointer-events-none select-none bg-orange-500/90 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse">
          VS
        </div>
      </Html>
    </group>
  );
}

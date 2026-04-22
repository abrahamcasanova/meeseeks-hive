import { memo } from 'react';
import type { Vector3Tuple } from 'three';

interface OfficeDeskProps {
  position: Vector3Tuple;
}

const LEG_POSITIONS: [number, number][] = [
  [-0.7, -0.35],
  [0.7, -0.35],
  [-0.7, 0.35],
  [0.7, 0.35],
];

export const OfficeDesk = memo(function OfficeDesk({ position }: OfficeDeskProps) {
  const [x, , z] = position;

  return (
    <group position={[x, 0, z]}>
      {/* Desk surface */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[1.6, 0.07, 0.9]} />
        <meshStandardMaterial color="#8b6f4e" />
      </mesh>

      {/* Desk legs */}
      {LEG_POSITIONS.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.36, lz]}>
          <boxGeometry args={[0.06, 0.72, 0.06]} />
          <meshStandardMaterial color="#6b5235" />
        </mesh>
      ))}

      {/* Monitor stand */}
      <mesh position={[0, 0.88, -0.3]}>
        <boxGeometry args={[0.06, 0.26, 0.06]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      {/* Monitor screen */}
      <mesh position={[0, 1.08, -0.3]}>
        <boxGeometry args={[0.72, 0.45, 0.04]} />
        <meshStandardMaterial color="#111827" emissive="#1a7acc" emissiveIntensity={1.2} />
      </mesh>

      {/* Monitor bezel */}
      <mesh position={[0, 1.08, -0.27]}>
        <boxGeometry args={[0.78, 0.51, 0.02]} />
        <meshStandardMaterial color="#2a2a3a" />
      </mesh>

      {/* Chair seat */}
      <mesh position={[0, 0.45, 0.55]}>
        <boxGeometry args={[0.55, 0.07, 0.5]} />
        <meshStandardMaterial color="#4a6fa5" />
      </mesh>

      {/* Chair back */}
      <mesh position={[0, 0.72, 0.78]}>
        <boxGeometry args={[0.5, 0.5, 0.06]} />
        <meshStandardMaterial color="#4a6fa5" />
      </mesh>

      {/* Chair leg (center post) */}
      <mesh position={[0, 0.22, 0.55]}>
        <boxGeometry args={[0.06, 0.44, 0.06]} />
        <meshStandardMaterial color="#6b5235" />
      </mesh>
    </group>
  );
});

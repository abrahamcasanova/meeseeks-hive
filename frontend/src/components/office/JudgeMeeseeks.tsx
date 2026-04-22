import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { Vector3Tuple } from 'three';

interface JudgeMeeseeksProps {
  winnerPosition: Vector3Tuple;
}

export function JudgeMeeseeks({ winnerPosition }: JudgeMeeseeksProps) {
  const groupRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);

  const [wx, , wz] = winnerPosition;
  const jx = wx + 1.2;
  const jz = wz + 0.7;

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = elapsed.current;
    const group = groupRef.current;
    if (!group) return;

    // Walk in during first 1.5s
    const arriveT = Math.min(t / 1.5, 1);
    const startX = jx + 3;
    const currentX = startX + (jx - startX) * (arriveT * arriveT * (3 - 2 * arriveT));
    group.position.set(currentX, 0.45, jz);

    // Arm raise after arrive
    if (armRef.current && t > 1.5) {
      const raiseT = Math.min((t - 1.5) / 0.8, 1);
      armRef.current.rotation.z = raiseT * Math.PI * 0.6;
      armRef.current.position.y = 0.18 + raiseT * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[jx + 3, 0.45, jz]}>
      {/* Body — gold */}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.35, 0.40, 0.24]} />
        <meshStandardMaterial color="#d4a017" roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Head */}
      <group position={[0, 0.48, 0]}>
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.26, 0.26, 0.26]} />
          <meshStandardMaterial color="#d4a017" roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[-0.06, 0.15, -0.14]}>
          <boxGeometry args={[0.045, 0.045, 0.02]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0.06, 0.15, -0.14]}>
          <boxGeometry args={[0.045, 0.045, 0.02]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        {/* Judge hat */}
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[0.30, 0.06, 0.30]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0, 0.32, 0]}>
          <boxGeometry args={[0.18, 0.08, 0.18]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      {/* Right arm (holding gavel) */}
      <mesh position={[0.25, 0.18, 0]}>
        <boxGeometry args={[0.10, 0.34, 0.12]} />
        <meshStandardMaterial color="#d4a017" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Gavel handle */}
      <mesh position={[0.25, 0.0, 0]}>
        <boxGeometry args={[0.04, 0.18, 0.04]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Gavel head */}
      <mesh position={[0.25, -0.08, 0]}>
        <boxGeometry args={[0.14, 0.06, 0.06]} />
        <meshStandardMaterial color="#5c3317" />
      </mesh>

      {/* Left arm (raises winner) */}
      <mesh ref={armRef} position={[-0.25, 0.18, 0]}>
        <boxGeometry args={[0.10, 0.34, 0.12]} />
        <meshStandardMaterial color="#d4a017" roughness={0.4} metalness={0.3} />
      </mesh>

      <Html position={[0, 1.1, 0]} center zIndexRange={[10, 0]}>
        <div
          className="pointer-events-none select-none whitespace-nowrap text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
          style={{
            color: '#d4a017',
            background: 'rgba(0,0,0,0.75)',
            border: '1px solid #d4a01766',
            textShadow: '0 0 8px #d4a01788',
          }}
        >
          JUDGE
        </div>
      </Html>
    </group>
  );
}

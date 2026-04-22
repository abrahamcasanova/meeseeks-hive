import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vector3Tuple } from 'three';

interface SpawnEffectProps {
  position: Vector3Tuple;
  onComplete?: () => void;
}

export function SpawnEffect({ position, onComplete }: SpawnEffectProps) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      doneRef.current = true;
      onComplete?.();
    }, 900);
    return () => clearTimeout(timeout);
  }, [onComplete]);

  useFrame((_state, delta) => {
    timeRef.current += delta;
    const t = Math.min(timeRef.current / 0.9, 1);

    if (ring1Ref.current) {
      ring1Ref.current.scale.setScalar(1 + t * 2.5);
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.8;
    }
    if (ring2Ref.current) {
      const t2 = Math.max(0, (t - 0.2) / 0.8);
      ring2Ref.current.scale.setScalar(1 + t2 * 1.8);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - t2) * 0.5;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ring1Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.3, 24]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.4, 24]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

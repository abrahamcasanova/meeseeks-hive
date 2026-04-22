import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vector3Tuple } from 'three';

interface Particle {
  offset: THREE.Vector3;
  velocity: THREE.Vector3;
  ref: React.RefObject<THREE.Mesh | null>;
}

interface DeathEffectProps {
  position: Vector3Tuple;
  color: THREE.Color;
  onComplete?: () => void;
}

export function DeathEffect({ position, color, onComplete }: DeathEffectProps) {
  const timeRef = useRef(0);

  const particles: Particle[] = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      return {
        offset: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(
          Math.cos(angle) * (0.8 + Math.random() * 0.8),
          1.5 + Math.random() * 1.5,
          Math.sin(angle) * (0.8 + Math.random() * 0.8),
        ),
        ref: { current: null } as React.RefObject<THREE.Mesh | null>,
      };
    });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => onComplete?.(), 1200);
    return () => clearTimeout(timeout);
  }, [onComplete]);

  useFrame((_state, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    for (const p of particles) {
      if (!p.ref.current) continue;
      const x = p.velocity.x * t;
      const y = p.velocity.y * t - 4.9 * t * t;
      const z = p.velocity.z * t;
      p.ref.current.position.set(x, y, z);
      const fade = Math.max(0, 1 - t / 1.2);
      (p.ref.current.material as THREE.MeshBasicMaterial).opacity = fade;
      p.ref.current.scale.setScalar(fade * 0.8 + 0.2);
    }
  });

  return (
    <group position={position}>
      {particles.map((p, i) => (
        <mesh key={i} ref={p.ref}>
          <boxGeometry args={[0.12, 0.12, 0.12]} />
          <meshBasicMaterial color={color} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  );
}

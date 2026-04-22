import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vector3Tuple } from 'three';

interface AncestryOrbitProps {
  ancestry: string[];
  position: Vector3Tuple;
}

const RADIUS = 0.8;
const SPEED  = 0.45; // rad/s
const Y      = 0.72;
const SIZE   = 0.14; // tamaño fijo igual para todos

export function AncestryOrbit({ ancestry, position }: AncestryOrbitProps) {
  const [px, , pz] = position;
  const cx = px;
  const cz = pz + 0.7;

  // Refs para los grupos de cada figura — máximo 8 ancestros
  const figureRefs = useRef<(THREE.Group | null)[]>([]);
  // Ángulos independientes por figura
  const anglesRef = useRef<number[]>([]);

  // Inicializar ángulos para figuras nuevas
  if (anglesRef.current.length !== ancestry.length) {
    const prev = anglesRef.current.length;
    anglesRef.current = ancestry.map((_, i) =>
      i < prev
        ? (anglesRef.current[i] ?? (i * Math.PI * 2) / ancestry.length)
        : (i * Math.PI * 2) / ancestry.length
    );
  }

  // UN solo useFrame mueve todas las figuras imperativamente
  useFrame((_, delta) => {
    for (let i = 0; i < ancestry.length; i++) {
      anglesRef.current[i] = ((anglesRef.current[i] ?? 0) + delta * SPEED) % (Math.PI * 2);
      const ref = figureRefs.current[i];
      if (!ref) continue;
      ref.position.set(
        cx + Math.cos(anglesRef.current[i]!) * RADIUS,
        Y,
        cz + Math.sin(anglesRef.current[i]!) * RADIUS
      );
    }
    // Ocultar refs sobrantes si ancestry se achicó
    for (let i = ancestry.length; i < figureRefs.current.length; i++) {
      const ref = figureRefs.current[i];
      if (ref) ref.visible = false;
    }
  });

  return (
    <group>
      {ancestry.map((_, i) => (
        <group
          key={i}
          ref={(el) => { figureRefs.current[i] = el; }}
          position={[cx + RADIUS, Y, cz]}
          visible
        >
          {/* Torso */}
          <mesh position={[0, SIZE * 0.4, 0]} renderOrder={10}>
            <boxGeometry args={[SIZE, SIZE * 0.9, SIZE * 0.7]} />
            <meshStandardMaterial
              color="#f59e0b"
              transparent
              opacity={0.65}
              depthWrite={false}
            />
          </mesh>
          {/* Cabeza */}
          <mesh position={[0, SIZE * 1.15, 0]} renderOrder={10}>
            <boxGeometry args={[SIZE * 0.8, SIZE * 0.8, SIZE * 0.8]} />
            <meshStandardMaterial
              color="#f59e0b"
              transparent
              opacity={0.65}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

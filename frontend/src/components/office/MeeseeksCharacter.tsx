import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { stressColor } from '@/utils/stressUtils';
import { hasHair } from '@/utils/nameUtils';
import { MeeseeksLabel } from './MeeseeksLabel';
import { MeeseeksTooltip } from './MeeseeksTooltip';
import { Html, Line } from '@react-three/drei';
import { SpawnEffect } from './SpawnEffect';
import { DeathEffect } from './DeathEffect';
import { SpeechBubble } from './SpeechBubble';
import type { Meeseeks } from '@/types';
import type { MeeseeksAnimationState } from '@/types/office';
import type { Vector3Tuple } from 'three';

interface MeeseeksCharacterProps {
  meeseeksId: string;
  meeseeks: Meeseeks;
  position: Vector3Tuple;
  animationState: MeeseeksAnimationState;
  isSelected: boolean;
  hasMemory?: boolean;
  ancestryCount?: number;
  learnedFromPosition?: Vector3Tuple;
  parentPosition?: Vector3Tuple;
  onClick: () => void;
}

// Meshes that share body color
type BodyMat = THREE.MeshStandardMaterial;

export function MeeseeksCharacter({
  meeseeksId,
  meeseeks,
  position,
  animationState,
  isSelected,
  hasMemory = false,
  ancestryCount = 0,
  learnedFromPosition,
  parentPosition,
  onClick,
}: MeeseeksCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const bodyMatsRef = useRef<BodyMat[]>([]);
  const [hovered, setHovered] = useState(false);
  const [showSpawn, setShowSpawn] = useState(animationState === 'spawning');
  const [showSpeech, _setShowSpeech] = useState(animationState === 'spawning');
  const [showDeath, setShowDeath] = useState(false);
  const spawnTimerRef = useRef(0);
  const walkTimerRef = useRef(0);

  // Current interpolated color
  const currentColor = useRef(new THREE.Color(stressColor(meeseeks.stress)));
  const targetColor = useRef(new THREE.Color(stressColor(meeseeks.stress)));

  useEffect(() => {
    targetColor.current.set(stressColor(meeseeks.stress));
  }, [meeseeks.stress]);

  useEffect(() => {
    if (animationState === 'dead') setShowDeath(true);
  }, [animationState]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const time = state.clock.elapsedTime;
    const seatY = 0.45;
    const [px, , pz] = position;

    // Reset head rotation each frame unless overridden below
    if (headGroupRef.current) headGroupRef.current.rotation.set(0, 0, 0);

    // Lerp color and apply to all body materials
    currentColor.current.lerp(targetColor.current, delta * 3);
    for (const mat of bodyMatsRef.current) {
      mat.color.copy(currentColor.current);
    }

    switch (animationState) {
      case 'spawning': {
        spawnTimerRef.current += delta;
        const t = Math.min(spawnTimerRef.current / 0.6, 1);
        const ease = t * t * (3 - 2 * t);
        group.scale.setScalar(ease);
        group.position.set(px, seatY + (1 - ease) * 0.5, pz + 0.7);
        break;
      }
      case 'working': {
        const bobY = Math.sin(time * 3) * 0.03;
        group.position.set(px, seatY + bobY, pz + 0.7);
        group.scale.setScalar(1);
        group.rotation.set(0, 0, 0);
        break;
      }
      case 'stressed': {
        const bobY = Math.sin(time * 6) * 0.05;
        const shakeX = (Math.random() - 0.5) * meeseeks.stress * 0.06;
        const shakeZ = (Math.random() - 0.5) * meeseeks.stress * 0.06;
        group.position.set(px + shakeX, seatY + bobY, pz + 0.7 + shakeZ);
        group.scale.setScalar(1);
        break;
      }
      case 'dying': {
        walkTimerRef.current += delta;
        const wt = walkTimerRef.current;
        // Only the head drops forward — pivot is at the neck (bottom of head)
        const headLean = Math.min(wt * 1.2, Math.PI * 0.5);
        if (headGroupRef.current) headGroupRef.current.rotation.set(-headLean, 0, 0);
        const grayTarget = new THREE.Color(0.45, 0.45, 0.45);
        currentColor.current.lerp(grayTarget, delta * 2);
        for (const mat of bodyMatsRef.current) mat.color.copy(currentColor.current);
        group.position.set(px, seatY, pz + 0.7);
        group.rotation.set(0, 0, 0);
        group.scale.setScalar(1);
        break;
      }
      case 'dead': {
        // Head stays dropped, body gray, clickable
        if (headGroupRef.current) headGroupRef.current.rotation.set(-Math.PI * 0.5, 0, 0);
        const grayDead = new THREE.Color(0.4, 0.4, 0.4);
        currentColor.current.copy(grayDead);
        for (const mat of bodyMatsRef.current) mat.color.copy(grayDead);
        group.position.set(px, seatY, pz + 0.7);
        group.rotation.set(0, 0, 0);
        group.scale.setScalar(1);
        break;
      }
      default: {
        group.position.set(px, seatY, pz + 0.7);
        group.scale.setScalar(1);
      }
    }
  });

  const isManager = meeseeks.role === 'manager';
  const showHair = hasHair(meeseeksId);
  const initColor = stressColor(meeseeks.stress);

  // Collect refs to body materials for imperative color updates
  const bodyRef = (mat: BodyMat | null) => {
    if (mat && !bodyMatsRef.current.includes(mat)) {
      bodyMatsRef.current.push(mat);
    }
  };

  return (
    <group>
      {(
        <group
          ref={groupRef}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        >
          {/* Torso */}
          <mesh position={[0, 0.28, 0]}>
            <boxGeometry args={[0.32, 0.38, 0.22]} />
            <meshStandardMaterial ref={bodyRef} color={initColor} />
          </mesh>

          {/* Head group — pivot at neck (y=0.48 = top of torso) */}
          <group ref={headGroupRef} position={[0, 0.48, 0]}>
            <mesh position={[0, 0.12, 0]}>
              <boxGeometry args={[0.24, 0.24, 0.24]} />
              <meshStandardMaterial ref={bodyRef} color={initColor} />
            </mesh>
            {/* Eyes offset relative to head center */}
            <mesh position={[-0.055, 0.15, -0.13]}>
              <boxGeometry args={[0.045, 0.045, 0.02]} />
              <meshStandardMaterial color="#111111" />
            </mesh>
            <mesh position={[0.055, 0.15, -0.13]}>
              <boxGeometry args={[0.045, 0.045, 0.02]} />
              <meshStandardMaterial color="#111111" />
            </mesh>

            {/* Hair — ~40% of Meeseeks, deterministic per ID */}
            {showHair && (
              <mesh position={[0.01, 0.30, 0.02]}>
                <boxGeometry args={[0.07, 0.10, 0.07]} />
                <meshStandardMaterial color="#c0392b" roughness={0.8} />
              </mesh>
            )}
          </group>

          {/* Left arm */}
          <mesh position={[-0.23, 0.18, 0]}>
            <boxGeometry args={[0.09, 0.32, 0.11]} />
            <meshStandardMaterial ref={bodyRef} color={initColor} />
          </mesh>

          {/* Right arm */}
          <mesh position={[0.23, 0.18, 0]}>
            <boxGeometry args={[0.09, 0.32, 0.11]} />
            <meshStandardMaterial ref={bodyRef} color={initColor} />
          </mesh>

          {/* Selection ring */}
          {isSelected && (
            <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.35, 0.42, 32]} />
              <meshBasicMaterial color="#22d3ee" side={THREE.DoubleSide} />
            </mesh>
          )}

          {/* Manager ring */}
          {isManager && !isSelected && (
            <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.35, 0.42, 32]} />
              <meshBasicMaterial color="#a855f7" side={THREE.DoubleSide} />
            </mesh>
          )}

          <MeeseeksLabel
            meeseeksId={meeseeksId}
            stress={meeseeks.stress}
            position={[0, 1.0, 0]}
            animationState={animationState}
            ancestryCount={ancestryCount}
          />

          {hasMemory && animationState !== 'dead' && (
            <Html position={[0, 1.32, 0]} center zIndexRange={[20, 0]}>
              <div
                className="pointer-events-none select-none text-[11px] px-1 py-0.5 rounded"
                style={{
                  background: 'rgba(0,0,0,0.7)',
                  border: '1px solid #f59e0b',
                  color: '#f59e0b',
                  textShadow: '0 0 6px #f59e0b88',
                }}
                title="Heredó estrategia"
              >
                💡
              </div>
            </Html>
          )}
        </group>
      )}

      {hovered && (
        <MeeseeksTooltip
          meeseeks={meeseeks}
          position={[position[0], 2.8, position[2] + 0.7]}
        />
      )}

      {showSpawn && (
        <SpawnEffect
          position={[position[0], 0.1, position[2] + 0.7]}
          onComplete={() => setShowSpawn(false)}
        />
      )}

      {showSpeech && (
        <SpeechBubble
          stress={meeseeks.stress}
          position={[position[0], 2.6, position[2] + 0.7]}
          duration={2800}
        />
      )}

      {showDeath && (
        <DeathEffect
          position={[position[0], 0.8, position[2] + 0.7]}
          color={currentColor.current.clone()}
          onComplete={() => setShowDeath(false)}
        />
      )}

      {/* Beam ámbar: este Meeseeks aprendió de learnedFromPosition */}
      {learnedFromPosition && animationState !== 'dead' && (
        <Line
          points={[
            [position[0], position[1] + 0.45 + 1.0, position[2] + 0.7],
            [learnedFromPosition[0], learnedFromPosition[1] + 0.45 + 1.0, learnedFromPosition[2] + 0.7],
          ]}
          color="#f59e0b"
          lineWidth={1.2}
          dashed
          dashSize={0.18}
          gapSize={0.1}
          transparent
          opacity={0.55}
        />
      )}

      {/* Beam cyan: este Meeseeks fue spawneado por parentPosition */}
      {parentPosition && animationState !== 'dead' && (
        <Line
          points={[
            [position[0], position[1] + 0.45 + 0.8, position[2] + 0.7],
            [parentPosition[0], parentPosition[1] + 0.45 + 0.8, parentPosition[2] + 0.7],
          ]}
          color="#22d3ee"
          lineWidth={1}
          dashed
          dashSize={0.15}
          gapSize={0.12}
          transparent
          opacity={0.4}
        />
      )}
    </group>
  );
}

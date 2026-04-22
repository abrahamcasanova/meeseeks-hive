import { useState, useEffect, useRef } from 'react';
import { useHiveStore } from '@/stores/hive.store';
import { useOfficeLayout } from '@/hooks/useOfficeLayout';
import { useMeeseeksAnimations } from '@/hooks/useMeeseeksAnimations';
import { OfficeFloor } from './OfficeFloor';
import { OfficeDeskGrid } from './OfficeDeskGrid';
import { MeeseeksCharacter } from './MeeseeksCharacter';
import { AncestryOrbit } from './AncestryOrbit';
import { JudgeMeeseeks } from './JudgeMeeseeks';
import { RaceIndicator } from './RaceIndicator';
import type { Meeseeks } from '@/types';
import type { MeeseeksAnimationState } from '@/types/office';
import type { Vector3Tuple } from 'three';

interface ActiveJudge {
  key: string;
  winnerId: string;
  winnerPosition: Vector3Tuple;
}

export function OfficeScene() {
  const meeseeksMap = useHiveStore((s) => s.meeseeks);
  const selectedId = useHiveStore((s) => s.selectedId);
  const setSelected = useHiveStore((s) => s.setSelected);
  const memoryInjected = useHiveStore((s) => s.memoryInjected);
  const memoryChain = useHiveStore((s) => s.memoryChain);
  const memoryNonces = useHiveStore((s) => s.memoryNonces);
  const races = useHiveStore((s) => s.races);

  const [activeJudges, setActiveJudges] = useState<ActiveJudge[]>([]);
  const seenRaces = useRef(new Set<string>());

  const { deskPositions, assignments, racePairs } = useOfficeLayout();
  const animationStates = useMeeseeksAnimations(meeseeksMap);

  // Spawn judge when a race finishes
  useEffect(() => {
    for (const [pid, race] of races) {
      if (!race.finished || !race.winnerId || seenRaces.current.has(pid)) continue;
      seenRaces.current.add(pid);
      const winnerPos = getDeskPos(race.winnerId);
      if (!winnerPos) continue;
      setActiveJudges(prev => [...prev, { key: pid, winnerId: race.winnerId!, winnerPosition: winnerPos }]);
    }
  }, [races]);

  // Remove judge when winner is gone (killed/reset)
  useEffect(() => {
    setActiveJudges(prev => prev.filter(j => {
      const m = meeseeksMap.get(j.winnerId);
      return !!m;
    }));
  }, [meeseeksMap]);

  function getDeskPos(id: string): Vector3Tuple | undefined {
    const a = assignments.get(id);
    if (!a) return undefined;
    return deskPositions[a.deskIndex]?.position;
  }

  const characters: {
    id: string;
    meeseeks: Meeseeks;
    deskPosition: Vector3Tuple;
    animState: MeeseeksAnimationState;
    isSelected: boolean;
    learnedFromPosition?: Vector3Tuple;
    parentPosition?: Vector3Tuple;
  }[] = [];

  for (const [id, assignment] of assignments) {
    const m = meeseeksMap.get(id);
    if (!m) continue;
    const desk = deskPositions[assignment.deskIndex];
    if (!desk) continue;
    const sourceId = memoryChain.get(id);
    characters.push({
      id,
      meeseeks: m,
      deskPosition: desk.position,
      animState: animationStates.get(id) ?? 'idle',
      isSelected: id === selectedId,
      learnedFromPosition: sourceId ? getDeskPos(sourceId) : undefined,
      parentPosition: m.parent_id ? getDeskPos(m.parent_id) : undefined,
    });
  }

  const raceIndicators = racePairs
    .map(([idA, idB]) => {
      const assignA = assignments.get(idA);
      const assignB = assignments.get(idB);
      if (!assignA || !assignB) return null;
      const posA = deskPositions[assignA.deskIndex]?.position;
      const posB = deskPositions[assignB.deskIndex]?.position;
      if (!posA || !posB) return null;
      return { key: `${idA}-${idB}`, posA, posB };
    })
    .filter((r): r is { key: string; posA: Vector3Tuple; posB: Vector3Tuple } => r !== null);

  // Órbitas de ancestros — persistentes mientras el aprendiz vive
  const orbits: { learnerId: string; ancestry: string[]; position: Vector3Tuple }[] = [];
  for (const [learnerId, { ancestry }] of memoryNonces) {
    if (ancestry.length === 0) continue;
    const m = meeseeksMap.get(learnerId);
    if (!m || m.status === 'dead' || m.status === 'dying') continue;
    const a = assignments.get(learnerId);
    if (!a) continue;
    const pos = deskPositions[a.deskIndex]?.position;
    if (!pos) continue;
    orbits.push({ learnerId, ancestry, position: pos });
  }

  return (
    <group>
      <OfficeFloor />
      <OfficeDeskGrid deskPositions={deskPositions} />

      {characters.map((c) => {
        const ancestry = memoryNonces.get(c.id)?.ancestry ?? [];
        return (
          <MeeseeksCharacter
            key={c.id}
            meeseeksId={c.id}
            meeseeks={c.meeseeks}
            position={c.deskPosition}
            animationState={c.animState}
            isSelected={c.isSelected}
            hasMemory={memoryInjected.has(c.id)}
            ancestryCount={ancestry.length}
            learnedFromPosition={c.learnedFromPosition}
            parentPosition={c.parentPosition}
            onClick={() => setSelected(c.id)}
          />
        );
      })}

      {orbits.map((o) => (
        <AncestryOrbit
          key={o.learnerId}
          ancestry={o.ancestry}
          position={o.position}
        />
      ))}

      {raceIndicators.map((ri) => (
        <RaceIndicator key={ri.key} posA={ri.posA} posB={ri.posB} />
      ))}

      {activeJudges.map((j) => (
        <JudgeMeeseeks
          key={j.key}
          winnerPosition={j.winnerPosition}
        />
      ))}
    </group>
  );
}

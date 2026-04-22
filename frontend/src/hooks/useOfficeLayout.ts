import { useRef, useMemo } from 'react';
import { useHiveStore } from '@/stores/hive.store';
import type { DeskPosition, DeskAssignment, OfficeLayoutConfig } from '@/types/office';

const DEFAULT_CONFIG: OfficeLayoutConfig = {
  rows: 4,
  cols: 5,
  deskSpacing: 4,
  originOffset: [0, 0, 0],
};

function generateDeskPositions(config: OfficeLayoutConfig): DeskPosition[] {
  const positions: DeskPosition[] = [];
  const totalWidth = (config.cols - 1) * config.deskSpacing;
  const totalDepth = (config.rows - 1) * config.deskSpacing;
  let index = 0;
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const x = col * config.deskSpacing - totalWidth / 2;
      const z = row * config.deskSpacing - totalDepth / 2;
      positions.push({ index, position: [x, 0, z], rotation: 0 });
      index++;
    }
  }
  return positions;
}

function findNextFreeDesk(occupied: Set<number>, total: number): number {
  for (let i = 0; i < total; i++) {
    if (!occupied.has(i)) return i;
  }
  return -1;
}

export function useOfficeLayout() {
  const meeseeks = useHiveStore((s) => s.meeseeks);
  const races = useHiveStore((s) => s.races);

  const deskPositions = useMemo(() => generateDeskPositions(DEFAULT_CONFIG), []);

  const assignmentRef = useRef<Map<string, number>>(new Map());
  const occupiedRef = useRef<Set<number>>(new Set());

  const assignments = useMemo(() => {
    const current = assignmentRef.current;
    const occupied = occupiedRef.current;
    const result = new Map<string, DeskAssignment>();

    // Remove assignments for gone Meeseeks
    for (const [id, deskIdx] of current) {
      if (!meeseeks.has(id)) {
        current.delete(id);
        occupied.delete(deskIdx);
      }
    }

    // Build race pair map for adjacent seating
    const racePairMap = new Map<string, string>();
    for (const [, race] of races) {
      if (race.competitors.length >= 2) {
        racePairMap.set(race.competitors[0]!, race.competitors[1]!);
        racePairMap.set(race.competitors[1]!, race.competitors[0]!);
      }
    }

    // Assign new Meeseeks to free desks
    for (const [id] of meeseeks) {
      if (current.has(id)) {
        result.set(id, { meeseeksId: id, deskIndex: current.get(id)! });
        continue;
      }

      let preferredIndex: number | undefined;
      const partnerId = racePairMap.get(id);
      if (partnerId && current.has(partnerId)) {
        const partnerDesk = current.get(partnerId)!;
        for (const candidate of [partnerDesk + 1, partnerDesk - 1]) {
          if (candidate >= 0 && candidate < deskPositions.length && !occupied.has(candidate)) {
            preferredIndex = candidate;
            break;
          }
        }
      }

      const deskIndex = preferredIndex ?? findNextFreeDesk(occupied, deskPositions.length);
      if (deskIndex !== -1) {
        current.set(id, deskIndex);
        occupied.add(deskIndex);
        result.set(id, { meeseeksId: id, deskIndex });
      }
    }

    return result;
  }, [meeseeks, races, deskPositions]);

  const racePairs = useMemo(() => {
    const pairs: [string, string][] = [];
    for (const [, race] of races) {
      if (race.competitors.length >= 2 && !race.finished) {
        pairs.push([race.competitors[0]!, race.competitors[1]!]);
      }
    }
    return pairs;
  }, [races]);

  return { deskPositions, assignments, racePairs };
}

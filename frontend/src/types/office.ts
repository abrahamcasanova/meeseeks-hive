import type { Vector3Tuple } from 'three';

export interface DeskPosition {
  index: number;
  position: Vector3Tuple;
  rotation: number;
}

export interface DeskAssignment {
  meeseeksId: string;
  deskIndex: number;
}

export type MeeseeksAnimationState =
  | 'spawning'
  | 'working'
  | 'stressed'
  | 'dying'
  | 'dead'
  | 'idle';

export interface OfficeLayoutConfig {
  rows: number;
  cols: number;
  deskSpacing: number;
  originOffset: Vector3Tuple;
}

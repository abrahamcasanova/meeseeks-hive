import type { DeskPosition } from '@/types/office';
import { OfficeDesk } from './OfficeDesk';

interface OfficeDeskGridProps {
  deskPositions: DeskPosition[];
}

export function OfficeDeskGrid({ deskPositions }: OfficeDeskGridProps) {
  return (
    <group>
      {deskPositions.map((desk) => (
        <OfficeDesk key={desk.index} position={desk.position} />
      ))}
    </group>
  );
}

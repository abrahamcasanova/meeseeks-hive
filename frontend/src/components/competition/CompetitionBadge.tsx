import { Trophy, Flag, Skull } from 'lucide-react';

interface Props {
  isCompeting: boolean;
  isWinner: boolean;
  lostRace: boolean;
}

export function CompetitionBadge({ isCompeting, isWinner, lostRace }: Props) {
  if (isWinner) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] bg-yellow-900/50 text-yellow-300 px-1.5 py-0.5 rounded">
        <Trophy size={10} /> Won
      </span>
    );
  }

  if (lostRace) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded">
        <Skull size={10} /> Lost
      </span>
    );
  }

  if (isCompeting) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded animate-pulse">
        <Flag size={10} /> Racing
      </span>
    );
  }

  return null;
}

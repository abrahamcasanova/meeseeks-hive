import { Plus } from 'lucide-react';

interface EmptyStateProps {
  onSpawn: () => void;
}

export function EmptyState({ onSpawn }: EmptyStateProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="text-center pointer-events-auto bg-gray-900/85 backdrop-blur-sm rounded-2xl px-8 py-6 border border-gray-700/50 shadow-2xl">
        <div className="text-5xl mb-3">👋</div>
        <p className="text-gray-300 text-sm mb-1 font-medium">I'm Mr. Meeseeks! Look at me!</p>
        <p className="text-gray-500 text-xs mb-4">Spawn your first agent to get started</p>
        <button
          onClick={onSpawn}
          className="inline-flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          Spawn Meeseeks
        </button>
      </div>
    </div>
  );
}

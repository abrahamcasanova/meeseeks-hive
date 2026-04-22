import { Network, Building2 } from 'lucide-react';

interface ViewToggleProps {
  viewMode: 'graph' | 'office';
  onChange: (mode: 'graph' | 'office') => void;
}

export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex bg-gray-900/80 backdrop-blur rounded-lg border border-gray-700 overflow-hidden">
      <button
        onClick={() => onChange('graph')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          viewMode === 'graph'
            ? 'bg-cyan-600 text-white'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        <Network size={14} />
        Graph
      </button>
      <button
        onClick={() => onChange('office')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          viewMode === 'office'
            ? 'bg-cyan-600 text-white'
            : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        <Building2 size={14} />
        Office
      </button>
    </div>
  );
}

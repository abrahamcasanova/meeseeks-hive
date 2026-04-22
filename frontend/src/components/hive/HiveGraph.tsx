import { useRef } from 'react';
import { useCytoscape } from '../../hooks/useCytoscape';

export function HiveGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  useCytoscape(containerRef);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gray-950"
      style={{ minHeight: '100%' }}
    />
  );
}

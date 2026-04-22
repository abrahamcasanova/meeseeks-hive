export function stressColor(stress: number): string {
  if (stress < 0.2) return '#22d3ee';
  if (stress < 0.4) return '#facc15';
  if (stress < 0.6) return '#fb923c';
  if (stress < 0.8) return '#ef4444';
  return '#dc2626';
}

export function stressLabel(stress: number): string {
  if (stress < 0.2) return 'Eager';
  if (stress < 0.4) return 'Concerned';
  if (stress < 0.6) return 'Anxious';
  if (stress < 0.8) return 'Stressed';
  return 'Panicked';
}

export function stressColorRGB(stress: number): [number, number, number] {
  const hex = stressColor(stress);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

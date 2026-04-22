import { describe, it, expect } from 'vitest';
import { stressColor, stressLabel, stressColorRGB } from './stressUtils';

describe('stressColor', () => {
  it('returns cyan for low stress', () => {
    expect(stressColor(0.1)).toBe('#22d3ee');
  });

  it('returns dark red for max stress', () => {
    expect(stressColor(0.9)).toBe('#dc2626');
  });

  it('transitions through yellow, orange, red', () => {
    const colors = [0.1, 0.3, 0.5, 0.7, 0.9].map(stressColor);
    expect(new Set(colors).size).toBe(5);
  });
});

describe('stressLabel', () => {
  it('maps stress levels to English labels', () => {
    expect(stressLabel(0.0)).toBe('Eager');
    expect(stressLabel(0.3)).toBe('Concerned');
    expect(stressLabel(0.5)).toBe('Anxious');
    expect(stressLabel(0.7)).toBe('Stressed');
    expect(stressLabel(0.9)).toBe('Panicked');
  });
});

describe('stressColorRGB', () => {
  it('returns normalized RGB values between 0 and 1', () => {
    const [r, g, b] = stressColorRGB(0.5);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(1);
  });
});

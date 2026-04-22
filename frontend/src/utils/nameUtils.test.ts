import { describe, it, expect } from 'vitest';
import { meeseeksName, hasHair } from './nameUtils';

describe('meeseeksName', () => {
  it('generates a name from a UUID', () => {
    const name = meeseeksName('550e8400-e29b-41d4-a716-446655440000');
    expect(name).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+$/);
  });

  it('is deterministic — same ID always returns same name', () => {
    const id = 'c39b4f5a-1234-5678-9abc-def012345678';
    expect(meeseeksName(id)).toBe(meeseeksName(id));
  });

  it('different IDs produce different names', () => {
    const a = meeseeksName('aaaaaaaa-0000-0000-0000-000000000000');
    const b = meeseeksName('bbbbbbbb-0000-0000-0000-000000000000');
    expect(a).not.toBe(b);
  });
});

describe('hasHair', () => {
  it('returns a boolean', () => {
    expect(typeof hasHair('550e8400-e29b-41d4-a716-446655440000')).toBe('boolean');
  });

  it('is deterministic', () => {
    const id = 'c39b4f5a-1234-5678-9abc-def012345678';
    expect(hasHair(id)).toBe(hasHair(id));
  });

  it('returns true for known ID with hair', () => {
    // hash=1, shifted=0, mod10=0 < 3 → true
    expect(hasHair('00000001-0000-0000-0000-000000000000')).toBe(true);
  });

  it('returns false for known ID without hair', () => {
    // hash=279839658, shifted=1093123, mod10=3 → not < 3 → false
    expect(hasHair('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });
});

const ADJECTIVES = [
  'Turbo', 'Mega', 'Ultra', 'Hyper', 'Blazing', 'Cosmic', 'Electric',
  'Frenzy', 'Glacial', 'Ionic', 'Kinetic', 'Lunar', 'Mystic', 'Neon',
  'Orbital', 'Plasma', 'Rapid', 'Solar', 'Vortex', 'Warp', 'Zeta',
  'Atomic', 'Quantum', 'Hollow', 'Jagged', 'Tidal', 'Xenon', 'Nano',
  'Savage', 'Crispy', 'Sneaky', 'Bouncy', 'Wobbly', 'Spooky', 'Funky',
];

const NOUNS = [
  'Rex', 'Zorp', 'Glorp', 'Bork', 'Florp', 'Wumbo', 'Snorp',
  'Dweeb', 'Vex', 'Quirk', 'Morp', 'Zonk', 'Plonk', 'Grix',
  'Fuzz', 'Quib', 'Zap', 'Blip', 'Norp', 'Gunk', 'Blorf',
  'Schmorp', 'Yoink', 'Bleep', 'Grunk', 'Squib', 'Zork', 'Meebs',
  'Floob', 'Gleep', 'Worp', 'Snoot', 'Bloop', 'Fizz', 'Plop',
];

function uuidToInt(uuid: string): number {
  // Sum first 8 hex chars as a simple hash
  let val = 0;
  for (let i = 0; i < Math.min(8, uuid.replace(/-/g, '').length); i++) {
    val = (val * 31 + parseInt(uuid.replace(/-/g, '')[i]!, 16)) >>> 0;
  }
  return val;
}

export function meeseeksName(id: string): string {
  const n = uuidToInt(id);
  const adj = ADJECTIVES[n % ADJECTIVES.length]!;
  const noun = NOUNS[Math.floor(n / ADJECTIVES.length) % NOUNS.length]!;
  return `${adj}-${noun}`;
}

// ~40% of Meeseeks have hair — deterministic per ID
export function hasHair(id: string): boolean {
  return (uuidToInt(id) >>> 8) % 10 < 3;
}

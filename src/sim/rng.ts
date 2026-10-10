// Seeded PRNG (mulberry32). Plain number state, no globals.

export interface Rng {
  /** uniform integer 0..n-1 (0 when n <= 1) */
  int(n: number): number;
  /** true with probability 1/n; always true for n <= 1 */
  chance(n: number): boolean;
  /** raw float in [0, 1) */
  next(): number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number): number => (n <= 1 ? 0 : Math.floor(next() * Math.floor(n)));
  return {
    next,
    int,
    chance: (n: number) => (n <= 1 ? true : int(n) === 0),
  };
}

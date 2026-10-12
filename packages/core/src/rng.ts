/** Deterministic pseudo-random source. Same seed, same sequence: rounds can be replayed and tested. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  weighted<T>(entries: readonly WeightedEntry<T>[]): T;
}

export interface WeightedEntry<T> {
  value: T;
  weight: number;
}

/** mulberry32: tiny, fast and good enough for game outcomes in a demo (not for real-money play). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Invalid int range [${min}, ${max}]`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };

  return {
    next,
    int,
    pick(items) {
      if (items.length === 0) throw new RangeError('Cannot pick from an empty list');
      return items[int(0, items.length - 1)]!;
    },
    weighted(entries) {
      const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
      if (!(total > 0)) throw new RangeError('Weighted pick needs at least one positive weight');
      let roll = next() * total;
      let last: (typeof entries)[number] | undefined;
      for (const entry of entries) {
        if (entry.weight <= 0) continue;
        last = entry;
        roll -= entry.weight;
        if (roll < 0) return entry.value;
      }
      // Float rounding can leave roll at ~0; fall back to the last positive entry.
      return last!.value;
    },
  };
}

/** `?seed=123` makes a session reproducible; otherwise a fresh seed per page load. */
export function seedFromQuery(search: string = window.location.search): number {
  const raw = new URLSearchParams(search).get('seed');
  const seed = raw === null ? NaN : Number(raw);
  return Number.isFinite(seed) ? seed >>> 0 : (Math.random() * 2 ** 32) >>> 0;
}

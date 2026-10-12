import { describe, expect, it } from 'vitest';
import { createRng, seedFromQuery } from './rng';

const take = (n: number, fn: () => number) => Array.from({ length: n }, fn);

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(take(20, a.next)).toEqual(take(20, b.next));
    expect(take(5, createRng(43).next)).not.toEqual(take(5, createRng(42).next));
  });

  it('returns floats in [0, 1)', () => {
    const rng = createRng(7);
    for (const n of take(10_000, rng.next)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('int() covers both bounds and nothing outside them', () => {
    const rng = createRng(1);
    const seen = new Set(take(2_000, () => rng.int(3, 6)));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('int() rejects invalid ranges', () => {
    const rng = createRng(1);
    expect(() => rng.int(5, 4)).toThrow(RangeError);
    expect(() => rng.int(0.5, 4)).toThrow(RangeError);
  });

  it('pick() returns items from the list and rejects an empty one', () => {
    const rng = createRng(3);
    const items = ['a', 'b', 'c'] as const;
    expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('weighted() follows the weights and never picks zero-weight entries', () => {
    const rng = createRng(99);
    const entries = [
      { value: 'common', weight: 70 },
      { value: 'never', weight: 0 },
      { value: 'rare', weight: 30 },
    ];
    const counts = { common: 0, never: 0, rare: 0 } as Record<string, number>;
    for (let i = 0; i < 20_000; i++) counts[rng.weighted(entries)]!++;

    expect(counts.never).toBe(0);
    expect(counts.common! / 20_000).toBeCloseTo(0.7, 1);
    expect(counts.rare! / 20_000).toBeCloseTo(0.3, 1);
  });

  it('weighted() rejects tables with no positive weight', () => {
    expect(() => createRng(1).weighted([{ value: 'x', weight: 0 }])).toThrow(RangeError);
  });
});

describe('seedFromQuery', () => {
  it('reads ?seed= from the query string', () => {
    expect(seedFromQuery('?seed=1234')).toBe(1234);
  });

  it('falls back to a random 32-bit seed', () => {
    const seed = seedFromQuery('?seed=abc');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });
});

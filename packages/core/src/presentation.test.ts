import { describe, expect, it } from 'vitest';
import { countUpSeconds } from './presentation';

describe('countUpSeconds', () => {
  it('grows with the win multiplier and is capped at 3 s', () => {
    expect(countUpSeconds(1)).toBeCloseTo(0.95);
    expect(countUpSeconds(10)).toBeGreaterThan(countUpSeconds(2));
    expect(countUpSeconds(160)).toBe(3);
  });
});

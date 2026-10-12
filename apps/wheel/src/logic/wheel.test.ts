import { createRng } from '@lab/core/logic';
import { describe, expect, it } from 'vitest';
import { createWheelEase } from './ease';
import {
  pegsPassed,
  segmentAtRotation,
  segmentCenter,
  segmentWidth,
  targetRotation,
} from './geometry';
import { exactStats, MAX_LANDING_OFFSET, resolveSpin, SEGMENTS } from './prizes';

const COUNT = SEGMENTS.length;
const TAU = Math.PI * 2;

describe('geometry', () => {
  it('finds the segment under the pointer', () => {
    // Rotating the wheel back by a segment's centre angle brings that segment to the top.
    for (let i = 0; i < COUNT; i++) {
      expect(segmentAtRotation(-segmentCenter(i, COUNT), COUNT)).toBe(i);
      expect(segmentAtRotation(-segmentCenter(i, COUNT) + 5 * TAU, COUNT)).toBe(i);
    }
    // Turning clockwise by a little less than one segment brings up the previous one.
    expect(segmentAtRotation(segmentWidth(COUNT) * 0.6, COUNT)).toBe(COUNT - 1);
  });

  it('targets land on the requested segment, forwards and far enough', () => {
    const rng = createRng(11);
    for (let i = 0; i < 500; i++) {
      const from = (rng.next() - 0.5) * 100;
      const index = rng.int(0, COUNT - 1);
      const offset = (rng.next() * 2 - 1) * MAX_LANDING_OFFSET;
      const minTravel = rng.next() * 20;
      const to = targetRotation(from, index, offset, COUNT, minTravel);

      expect(segmentAtRotation(to, COUNT)).toBe(index);
      expect(to - from).toBeGreaterThanOrEqual(minTravel);
      expect(to - from).toBeLessThan(minTravel + TAU);
    }
  });

  it('counts pegs passed while turning forwards', () => {
    const w = segmentWidth(COUNT);
    expect(pegsPassed(0.1 * w, 0.9 * w, COUNT)).toBe(0);
    expect(pegsPassed(0.9 * w, 1.1 * w, COUNT)).toBe(1);
    expect(pegsPassed(0, TAU, COUNT)).toBe(COUNT);
    expect(pegsPassed(-0.5 * w, 0.5 * w, COUNT)).toBe(1);
    expect(pegsPassed(2 * w, w, COUNT)).toBe(0);
  });
});

describe('createWheelEase', () => {
  const ease = createWheelEase({ overshoot: 0.02 });

  it('starts at 0, ends exactly on the target and peaks just past it', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    const samples = Array.from({ length: 1001 }, (_, i) => ease(i / 1000));
    expect(Math.max(...samples)).toBeCloseTo(1.02, 5);
  });

  it('only moves forwards until the peak, then only settles back', () => {
    const samples = Array.from({ length: 1001 }, (_, i) => ease(i / 1000));
    const peak = samples.indexOf(Math.max(...samples));
    for (let i = 1; i <= peak; i++) expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]!);
    for (let i = peak + 1; i < samples.length; i++) {
      expect(samples[i]!).toBeLessThanOrEqual(samples[i - 1]!);
    }
  });

  it('reports its starting slope so the spin speed can be matched', () => {
    const h = 1e-6;
    expect(ease(h) / h).toBeCloseTo(ease.initialSlope, 3);
  });
});

describe('prizes', () => {
  it('has an RTP between 95% and 96%', () => {
    const { rtp } = exactStats();
    expect(rtp).toBeGreaterThan(0.95);
    expect(rtp).toBeLessThan(0.96);
  });

  it('lists the odds of every multiplier, adding up to 1', () => {
    const { odds } = exactStats();
    expect(odds.map((o) => o.multiplier)).toEqual([50, 10, 5, 3, 2, 1, 0]);
    expect(odds.reduce((sum, o) => sum + o.chance, 0)).toBeCloseTo(1, 10);
  });

  it('resolves deterministically and pays bet × multiplier', () => {
    const a = createRng(3);
    const b = createRng(3);
    for (let i = 0; i < 100; i++) {
      const round = resolveSpin({ bet: 10 }, a);
      expect(resolveSpin({ bet: 10 }, b)).toEqual(round);
      expect(round.outcome.multiplier).toBe(SEGMENTS[round.outcome.segment]!.multiplier);
      expect(round.win).toBe(10 * round.outcome.multiplier);
      expect(Math.abs(round.outcome.offset)).toBeLessThanOrEqual(MAX_LANDING_OFFSET);
    }
  });

  it('lands on each segment in proportion to its weight', () => {
    const rng = createRng(21);
    const spins = 99_900;
    const counts = new Array<number>(COUNT).fill(0);
    for (let i = 0; i < spins; i++) counts[resolveSpin({ bet: 1 }, rng).outcome.segment]!++;
    const total = SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
    SEGMENTS.forEach((segment, i) => {
      const expected = (spins * segment.weight) / total;
      // Within 5 standard deviations of a binomial count.
      const sd = Math.sqrt(expected * (1 - segment.weight / total));
      expect(Math.abs(counts[i]! - expected)).toBeLessThan(5 * sd);
    });
  });
});

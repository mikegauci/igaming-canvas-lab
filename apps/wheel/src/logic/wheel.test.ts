import { createRng } from '@lab/core/logic';
import { describe, expect, it } from 'vitest';
import { createWheelEase } from './ease';
import { pointerRotation } from './pointer';
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
  it.each([2, 3])('lands without reversing or crossing the target (power %i)', (power) => {
    const ease = createWheelEase({ power });
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let previous = 0;
    for (let i = 0; i <= 1000; i++) {
      const value = ease(i / 1000);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
    expect(ease.slope(1)).toBe(0);
  });

  it.each([2, 3])('matches the free-spin and replanned STOP speeds (power %i)', (power) => {
    const ease = createWheelEase({ power });
    const speed = 9;
    const travel = 10;
    const duration = (travel * ease.initialSlope) / speed;
    expect((travel * ease.slope(0)) / duration).toBeCloseTo(speed, 10);
    const h = 1e-6;
    expect(ease(h) / h).toBeCloseTo(ease.initialSlope, 3);
    for (const progress of [0.1, 0.5, 0.8]) {
      const currentSpeed = (travel * ease.slope(progress)) / duration;
      const stopEase = createWheelEase({ power: 2 });
      const stopTravel = 3;
      const stopDuration = (stopTravel * stopEase.initialSlope) / currentSpeed;
      expect((stopTravel * stopEase.slope(0)) / stopDuration).toBeCloseTo(currentSpeed, 10);
    }
  });

  it('never exits the final sector after its last peg, even at the landing offset limits', () => {
    const w = segmentWidth(COUNT);
    for (const power of [2, 3]) {
      const ease = createWheelEase({ power });
      for (let segment = 0; segment < COUNT; segment++) {
        for (const offset of [-MAX_LANDING_OFFSET, 0, MAX_LANDING_OFFSET]) {
          const from = -0.7;
          const to = targetRotation(from, segment, offset, COUNT, 10);
          const finalEdge = Math.floor(to / w) * w;
          for (let i = 0; i <= 1000; i++) {
            const rotation = from + (to - from) * ease(i / 1000);
            if (rotation > finalEdge) expect(segmentAtRotation(rotation, COUNT)).toBe(segment);
          }
        }
      }
    }
  });
});

describe('pointer contact', () => {
  it('starts flexing on approach and stays pushed while the peg crosses the top', () => {
    const approach = pointerRotation(-0.08, -0.04, COUNT, 0, 1 / 60);
    const crossing = pointerRotation(-0.04, 0, COUNT, approach, 1 / 60);
    const leaving = pointerRotation(0, 0.04, COUNT, crossing, 1 / 60);
    expect(approach).toBeLessThan(0);
    expect(crossing).toBeLessThan(approach);
    expect(leaving).toBeLessThan(crossing);
  });

  it('tracks the same contact across positive and negative full turns', () => {
    const contact = pointerRotation(-0.04, 0.02, COUNT, 0, 1 / 60);
    for (const turns of [-5, -1, 1, 5]) {
      expect(pointerRotation(turns * TAU - 0.04, turns * TAU + 0.02, COUNT, 0, 1 / 60)).toBeCloseTo(
        contact,
        10,
      );
    }
  });

  it('still flicks when a slow frame skips an entire peg contact', () => {
    const rotation = pointerRotation(-0.1, 0.15, COUNT, 0, 1 / 30);
    expect(rotation).toBeLessThan(0);
    expect(rotation).toBeGreaterThan(-0.38);
  });

  it('returns home at the same rate regardless of frame rate', () => {
    const released = pointerRotation(0.04, 0.08, COUNT, -0.3, 1 / 60);
    const oneFrame = pointerRotation(0.08, 0.08, COUNT, released, 1 / 30);
    const firstHalf = pointerRotation(0.08, 0.08, COUNT, released, 1 / 60);
    const twoFrames = pointerRotation(0.08, 0.08, COUNT, firstHalf, 1 / 60);
    expect(oneFrame).toBeCloseTo(twoFrames, 10);
    expect(pointerRotation(0.08, 0.08, COUNT, released, 0.5)).toBe(0);
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
    // Long statistical run: allow for slow or busy CI machines.
  }, 30_000);
});

import type { Resolver } from '@lab/core/logic';

export interface Segment {
  /** Win = bet × multiplier. 0 is a miss. */
  multiplier: number;
  /**
   * Relative chance of landing here. Segments look equal on the wheel, but the server picks one
   * by weight, which is how real prize wheels set their maths.
   */
  weight: number;
}

/** Clockwise from the top, as drawn. Weights sum to 999. */
export const SEGMENTS: readonly Segment[] = [
  { multiplier: 1, weight: 70 },
  { multiplier: 5, weight: 30 },
  { multiplier: 0, weight: 209 },
  { multiplier: 2, weight: 40 },
  { multiplier: 10, weight: 13 },
  { multiplier: 1, weight: 70 },
  { multiplier: 0, weight: 209 },
  { multiplier: 3, weight: 35 },
  { multiplier: 50, weight: 4 },
  { multiplier: 1, weight: 70 },
  { multiplier: 0, weight: 209 },
  { multiplier: 2, weight: 40 },
];

export const BET_LEVELS = [1, 2, 5, 10, 20, 50, 100] as const;

/** How far from a segment's centre the wheel may stop, as a share of the segment's width. */
export const MAX_LANDING_OFFSET = 0.35;

export interface WheelRequest {
  bet: number;
}

export interface WheelOutcome {
  /** Index into SEGMENTS. */
  segment: number;
  /** Where in the segment the pointer stops, in [-MAX_LANDING_OFFSET, MAX_LANDING_OFFSET]. */
  offset: number;
  multiplier: number;
}

/**
 * Server-side maths for one spin. The landing offset is decided here too, so a seeded replay
 * shows exactly the same spin.
 */
export const resolveSpin: Resolver<WheelRequest, WheelOutcome> = ({ bet }, rng) => {
  const segment = rng.weighted(SEGMENTS.map((s, index) => ({ value: index, weight: s.weight })));
  const offset = (rng.next() * 2 - 1) * MAX_LANDING_OFFSET;
  const { multiplier } = SEGMENTS[segment]!;
  return { outcome: { segment, offset, multiplier }, win: bet * multiplier };
};

export interface WheelStats {
  rtp: number;
  /** Chance of winning anything (including getting the bet back). */
  hitRate: number;
  /** Chance of winning more than the bet. */
  profitRate: number;
  /** Chance of each distinct multiplier, highest first. */
  odds: { multiplier: number; chance: number }[];
}

/** Exact figures straight from the weights. */
export function exactStats(segments: readonly Segment[] = SEGMENTS): WheelStats {
  const total = segments.reduce((sum, s) => sum + s.weight, 0);
  const chance = (keep: (s: Segment) => boolean) =>
    segments.filter(keep).reduce((sum, s) => sum + s.weight, 0) / total;
  const multipliers = [...new Set(segments.map((s) => s.multiplier))].sort((a, b) => b - a);
  return {
    rtp: segments.reduce((sum, s) => sum + s.multiplier * s.weight, 0) / total,
    hitRate: chance((s) => s.multiplier > 0),
    profitRate: chance((s) => s.multiplier > 1),
    odds: multipliers.map((m) => ({ multiplier: m, chance: chance((s) => s.multiplier === m) })),
  };
}

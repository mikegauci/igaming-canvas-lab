import type { Resolver } from '@lab/core/logic';

/** Chest prizes as multipliers of the stake, with their weights out of 10,000. */
export const PRIZES: readonly { multiplier: number; weight: number }[] = [
  { multiplier: 0, weight: 3698 },
  { multiplier: 0.5, weight: 3000 },
  { multiplier: 1, weight: 2000 },
  { multiplier: 2, weight: 800 },
  { multiplier: 5, weight: 300 },
  { multiplier: 10, weight: 150 },
  { multiplier: 25, weight: 40 },
  { multiplier: 50, weight: 12 },
];

/** Even stakes, so half-stake prizes stay whole credits. */
export const BET_LEVELS = [2, 4, 10, 20, 50, 100, 200] as const;

export const CHESTS = 3;

export interface BonusRequest {
  bet: number;
}

export interface BonusOutcome {
  /** Multiplier in the chest the player picked. */
  multiplier: number;
  /** What the two other chests held, shown afterwards. */
  others: [number, number];
}

const drawMultiplier = (rng: Parameters<Resolver<BonusRequest, BonusOutcome>>[1]) =>
  rng.weighted(PRIZES.map((p) => ({ value: p.multiplier, weight: p.weight })));

/**
 * The pick itself is cosmetic: the server decides the prize when the chest is picked, and also
 * what the other chests "held", so the reveal afterwards is consistent and replayable.
 */
export const resolveBonus: Resolver<BonusRequest, BonusOutcome> = ({ bet }, rng) => {
  const multiplier = drawMultiplier(rng);
  const others: [number, number] = [drawMultiplier(rng), drawMultiplier(rng)];
  return { outcome: { multiplier, others }, win: Math.floor(bet * multiplier) };
};

/**
 * Showcase helper for `?demo=big|mega|epic`: always lands that tier so the celebration can be
 * seen (and recorded) without waiting for a 1-in-800 draw. Clearly not real odds.
 */
export function forcedResolver(multiplier: number): Resolver<BonusRequest, BonusOutcome> {
  return ({ bet }, rng) => ({
    outcome: { multiplier, others: [drawMultiplier(rng), drawMultiplier(rng)] },
    win: Math.floor(bet * multiplier),
  });
}

export interface BonusStats {
  rtp: number;
  /** Chance the picked chest pays anything. */
  hitRate: number;
  /** Chance of a BIG WIN or better (10× and up). */
  bigWinRate: number;
}

export function exactStats(): BonusStats {
  const total = PRIZES.reduce((sum, p) => sum + p.weight, 0);
  const share = (keep: (m: number) => boolean) =>
    PRIZES.filter((p) => keep(p.multiplier)).reduce((sum, p) => sum + p.weight, 0) / total;
  return {
    rtp: PRIZES.reduce((sum, p) => sum + p.multiplier * p.weight, 0) / total,
    hitRate: share((m) => m > 0),
    bigWinRate: share((m) => m >= 10),
  };
}

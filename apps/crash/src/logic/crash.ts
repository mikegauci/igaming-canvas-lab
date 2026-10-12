/**
 * Crash maths. A round's multiplier grows exponentially from 1.00× until the crash point the
 * server drew at the start. Cash out before it to win bet × multiplier; at or after it, you lose.
 */

/** Long-run return: crash points are drawn so that P(crash ≥ x) = RTP / x. */
export const RTP = 0.97;
/** Growth rate per second: 2× after ~4.6 s, 10× after ~15 s. */
export const GROWTH = 0.15;

export const BET_LEVELS = [1, 2, 5, 10, 20, 50, 100] as const;
/** Auto cash-out targets the player can cycle through; null is off. */
export const AUTO_TARGETS = [null, 1.5, 2, 3, 5, 10] as const;
export type AutoTarget = (typeof AUTO_TARGETS)[number];

/** Multipliers are shown and settled in whole hundredths, rounded down. */
export const toCents = (multiplier: number): number => Math.floor(multiplier * 100 + 1e-9) / 100;

/**
 * Crash point from a uniform random number in [0, 1). The `1 - r` in the denominator gives the
 * heavy tail (most rounds bust early, a few run very high); a draw below the RTP line crashes
 * instantly at 1.00×, which is where the house edge comes from.
 */
export function crashPointFrom(random: number, rtp = RTP): number {
  return Math.max(1, toCents(rtp / (1 - random)));
}

export const multiplierAt = (seconds: number): number => Math.exp(GROWTH * Math.max(0, seconds));

export const secondsToReach = (multiplier: number): number => Math.log(multiplier) / GROWTH;

export type Settlement =
  { cashedOut: true; multiplier: number; win: number } | { cashedOut: false; crashPoint: number };

/**
 * Settles a cash-out request that the server received `elapsed` seconds into the round. It wins
 * only if the multiplier at that moment is still below the crash point.
 */
export function settleCashOut(crashPoint: number, elapsed: number, bet: number): Settlement {
  const multiplier = toCents(multiplierAt(elapsed));
  if (multiplier >= crashPoint) return { cashedOut: false, crashPoint };
  return { cashedOut: true, multiplier, win: Math.floor(bet * multiplier) };
}

/** Chance that a round reaches at least `multiplier` (exact, from the draw formula). */
export const chanceToReach = (multiplier: number, rtp = RTP): number =>
  multiplier <= 1 ? 1 : Math.min(1, rtp / multiplier);

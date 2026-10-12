/** Bigger wins (relative to the bet) count up for longer, capped so the game never drags. */
export const countUpSeconds = (multiplier: number): number =>
  Math.min(3, 0.6 + 0.35 * Math.log2(1 + multiplier));

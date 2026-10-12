import { countUpSeconds } from '@lab/core/logic';

export type TierName = 'BIG' | 'MEGA' | 'EPIC';

/** Win tiers by multiple of the stake, lowest first. */
export const TIERS: readonly { name: TierName; at: number }[] = [
  { name: 'BIG', at: 10 },
  { name: 'MEGA', at: 25 },
  { name: 'EPIC', at: 50 },
];

/** Highest tier a win reaches, or null for an ordinary win. */
export function tierFor(win: number, bet: number): TierName | null {
  let reached: TierName | null = null;
  for (const tier of TIERS) if (win >= tier.at * bet) reached = tier.name;
  return reached;
}

export interface CountUpStep {
  /** Banner shown while this step counts; null for an ordinary win. */
  tier: TierName | null;
  from: number;
  to: number;
  /** Seconds. */
  duration: number;
}

/** Seconds spent counting through each tier: long enough to build, short enough to not drag. */
export const TIER_STEP_SECONDS = 1.8;
/** Extra time on the last step so the final number lands with weight. */
export const FINAL_HOLD_SECONDS = 0.6;

/**
 * Plans the win roll-up. An ordinary win counts straight up. A tiered win starts under the BIG
 * banner and upgrades as the counter passes each next threshold (MEGA at 25×, EPIC at 50×), the
 * classic slot big-win sequence. Steps are contiguous and end exactly on the win.
 */
export function planCountUp(win: number, bet: number): CountUpStep[] {
  if (win <= 0) return [];
  const top = tierFor(win, bet);
  if (top === null) {
    return [{ tier: null, from: 0, to: win, duration: countUpSeconds(win / bet) }];
  }

  const reached = TIERS.filter((tier) => win >= tier.at * bet);
  return reached.map((tier, i) => {
    const next = reached[i + 1];
    const last = next === undefined;
    return {
      tier: tier.name,
      from: i === 0 ? 0 : tier.at * bet,
      to: last ? win : next.at * bet,
      duration: TIER_STEP_SECONDS + (last ? FINAL_HOLD_SECONDS : 0),
    };
  });
}

import { PAYLINES, REEL_STRIPS } from './config';
import { evaluate, gridAt, totalWin } from './evaluate';

export interface SlotStats {
  /** Return to player: average payout per unit staked. */
  rtp: number;
  /** Share of spins that pay anything. */
  hitRate: number;
  /** Biggest single-spin win as a multiple of the total bet. */
  maxWinMultiplier: number;
}

/**
 * Exact figures from every combination of reel stops (24³ = 13,824 spins), not a simulation.
 * This is how slot maths is usually certified, and it runs in a few milliseconds.
 */
export function exactStats(strips = REEL_STRIPS): SlotStats {
  const lineBet = 1;
  const stake = lineBet * PAYLINES.length;
  let returned = 0;
  let hits = 0;
  let maxWin = 0;
  let spins = 0;

  const visit = (stops: number[]) => {
    if (stops.length < strips.length) {
      for (let i = 0; i < strips[stops.length]!.length; i++) visit([...stops, i]);
      return;
    }
    const win = totalWin(evaluate(gridAt(stops, strips), lineBet));
    spins++;
    returned += win;
    if (win > 0) hits++;
    maxWin = Math.max(maxWin, win);
  };
  visit([]);

  return {
    rtp: returned / (spins * stake),
    hitRate: hits / spins,
    maxWinMultiplier: maxWin / stake,
  };
}

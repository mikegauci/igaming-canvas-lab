import type { Resolver } from '@lab/core/logic';
import { PAYLINES, PAYTABLE, REEL_STRIPS, ROWS, type SymbolId } from './config';

/** grid[reel][row] */
export type Grid = SymbolId[][];

export interface LineWin {
  /** Index into PAYLINES. */
  line: number;
  symbol: SymbolId;
  payout: number;
}

export interface SpinRequest {
  /** Total stake for the spin. */
  bet: number;
}

export interface SpinOutcome {
  /** Strip index shown in the top row of each reel. */
  stops: number[];
  grid: Grid;
  wins: LineWin[];
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function gridAt(stops: readonly number[], strips = REEL_STRIPS): Grid {
  return strips.map((strip, reel) =>
    Array.from({ length: ROWS }, (_, row) => strip[mod(stops[reel]! + row, strip.length)]!),
  );
}

/** Pays three of a kind on each payline. */
export function evaluate(grid: Grid, lineBet: number): LineWin[] {
  const wins: LineWin[] = [];
  PAYLINES.forEach((rows, line) => {
    const symbols = rows.map((row, reel) => grid[reel]![row]!);
    const [first] = symbols;
    if (first !== undefined && symbols.every((s) => s === first)) {
      wins.push({ line, symbol: first, payout: PAYTABLE[first] * lineBet });
    }
  });
  return wins;
}

export const totalWin = (wins: readonly LineWin[]): number =>
  wins.reduce((sum, win) => sum + win.payout, 0);

/** Server-side maths for one spin: pick a stop per reel, then pay what lands. */
export const resolveSpin: Resolver<SpinRequest, SpinOutcome> = ({ bet }, rng) => {
  if (bet % PAYLINES.length !== 0) {
    throw new RangeError(`Bet ${bet} must divide evenly across ${PAYLINES.length} lines`);
  }
  const stops = REEL_STRIPS.map((strip) => rng.int(0, strip.length - 1));
  const grid = gridAt(stops);
  const wins = evaluate(grid, bet / PAYLINES.length);
  return { outcome: { stops, grid, wins }, win: totalWin(wins) };
};

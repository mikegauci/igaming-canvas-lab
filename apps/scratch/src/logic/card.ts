import type { Resolver, Rng } from '@lab/core/logic';

/** Prize symbols on the card, as multipliers of the card price. */
export const SYMBOLS = [1, 2, 5, 10, 20, 100] as const;
export type CardSymbol = (typeof SYMBOLS)[number];

export const CELLS = 9;

/**
 * Chance of each outcome, out of 10,000. The prize is decided first; the card is then laid out
 * to show it (three of the winning symbol, no other triple).
 */
export const PRIZE_WEIGHTS: readonly { prize: CardSymbol | null; weight: number }[] = [
  { prize: null, weight: 6878 },
  { prize: 1, weight: 1500 },
  { prize: 2, weight: 1000 },
  { prize: 5, weight: 400 },
  { prize: 10, weight: 150 },
  { prize: 20, weight: 60 },
  { prize: 100, weight: 12 },
];

export const BET_LEVELS = [1, 2, 5, 10, 20, 50, 100] as const;

export interface CardRequest {
  bet: number;
}

export interface CardOutcome {
  /** Winning symbol, or null for no win. */
  prize: CardSymbol | null;
  /** Symbol in each cell, row by row. */
  cells: CardSymbol[];
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/**
 * Lays out a card for a decided prize: three of the prize symbol and fillers that appear at most
 * twice each, so the card can't show a second (or accidental) win.
 */
export function layoutFor(prize: CardSymbol | null, rng: Rng): CardSymbol[] {
  const fillers = SYMBOLS.filter((s) => s !== prize).flatMap((s) => [s, s]);
  const winners = prize === null ? [] : [prize, prize, prize];
  const picked = shuffle(fillers, rng).slice(0, CELLS - winners.length);
  return shuffle([...winners, ...picked], rng);
}

/** Cells holding three of a kind, if any. */
export function winningCells(cells: readonly CardSymbol[]): number[] {
  for (const symbol of SYMBOLS) {
    const matches = cells.flatMap((s, i) => (s === symbol ? [i] : []));
    if (matches.length >= 3) return matches;
  }
  return [];
}

export const resolveCard: Resolver<CardRequest, CardOutcome> = ({ bet }, rng) => {
  const prize = rng.weighted(PRIZE_WEIGHTS.map((p) => ({ value: p.prize, weight: p.weight })));
  return {
    outcome: { prize, cells: layoutFor(prize, rng) },
    win: prize === null ? 0 : bet * prize,
  };
};

export interface CardStats {
  rtp: number;
  hitRate: number;
  /** Chance of each prize, highest first. */
  odds: { prize: CardSymbol; chance: number }[];
}

export function exactStats(): CardStats {
  const total = PRIZE_WEIGHTS.reduce((sum, p) => sum + p.weight, 0);
  const wins = PRIZE_WEIGHTS.filter(
    (p): p is { prize: CardSymbol; weight: number } => p.prize !== null,
  );
  return {
    rtp: wins.reduce((sum, p) => sum + p.prize * p.weight, 0) / total,
    hitRate: wins.reduce((sum, p) => sum + p.weight, 0) / total,
    odds: wins
      .map((p) => ({ prize: p.prize, chance: p.weight / total }))
      .sort((a, b) => b.prize - a.prize),
  };
}

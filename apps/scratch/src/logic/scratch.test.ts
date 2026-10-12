import { createRng } from '@lab/core/logic';
import { describe, expect, it } from 'vitest';
import {
  CELLS,
  exactStats,
  layoutFor,
  PRIZE_WEIGHTS,
  resolveCard,
  SYMBOLS,
  winningCells,
  type CardSymbol,
} from './card';
import { CoverageGrid } from './coverage';

const counts = (cells: readonly CardSymbol[]) =>
  cells.reduce((map, s) => map.set(s, (map.get(s) ?? 0) + 1), new Map<CardSymbol, number>());

describe('layoutFor', () => {
  it('shows exactly one triple, of the prize, on winning cards', () => {
    const rng = createRng(1);
    for (const prize of SYMBOLS) {
      for (let i = 0; i < 200; i++) {
        const cells = layoutFor(prize, rng);
        expect(cells).toHaveLength(CELLS);
        const tally = counts(cells);
        expect(tally.get(prize)).toBe(3);
        for (const [symbol, count] of tally) if (symbol !== prize) expect(count).toBeLessThan(3);
      }
    }
  });

  it('never shows three of a kind on losing cards', () => {
    const rng = createRng(2);
    for (let i = 0; i < 1000; i++) {
      const cells = layoutFor(null, rng);
      expect(cells).toHaveLength(CELLS);
      expect(Math.max(...counts(cells).values())).toBeLessThan(3);
      expect(winningCells(cells)).toEqual([]);
    }
  });

  it('puts the winning symbols in different places from card to card', () => {
    const rng = createRng(3);
    const positions = new Set<string>();
    for (let i = 0; i < 100; i++) positions.add(winningCells(layoutFor(5, rng)).join());
    expect(positions.size).toBeGreaterThan(30);
  });
});

describe('resolveCard', () => {
  it('pays bet × prize and lays out the card to match', () => {
    const rng = createRng(4);
    for (let i = 0; i < 2000; i++) {
      const { outcome, win } = resolveCard({ bet: 5 }, rng);
      const winners = winningCells(outcome.cells);
      if (outcome.prize === null) {
        expect(win).toBe(0);
        expect(winners).toEqual([]);
      } else {
        expect(win).toBe(5 * outcome.prize);
        expect(winners.map((i) => outcome.cells[i])).toEqual([
          outcome.prize,
          outcome.prize,
          outcome.prize,
        ]);
      }
    }
  });

  it('draws each prize as often as its weight says', () => {
    const rng = createRng(12);
    const cards = 100_000;
    const counts = new Map<CardSymbol | null, number>();
    for (let i = 0; i < cards; i++) {
      const { prize } = resolveCard({ bet: 1 }, rng).outcome;
      counts.set(prize, (counts.get(prize) ?? 0) + 1);
    }
    const total = PRIZE_WEIGHTS.reduce((sum, p) => sum + p.weight, 0);
    for (const { prize, weight } of PRIZE_WEIGHTS) {
      const p = weight / total;
      const expected = cards * p;
      // Within 5 standard deviations of a binomial count.
      expect(Math.abs((counts.get(prize) ?? 0) - expected)).toBeLessThan(
        5 * Math.sqrt(cards * p * (1 - p)),
      );
    }
    // Long statistical run: allow for slow or busy CI machines.
  }, 30_000);

  it('is deterministic for a seed', () => {
    const a = createRng(9);
    const b = createRng(9);
    for (let i = 0; i < 50; i++)
      expect(resolveCard({ bet: 1 }, a)).toEqual(resolveCard({ bet: 1 }, b));
  });
});

describe('exactStats', () => {
  it('has an RTP of 94% and a win on about 31% of cards', () => {
    const { rtp, hitRate, odds } = exactStats();
    expect(rtp).toBeCloseTo(0.94, 6);
    expect(hitRate).toBeCloseTo(0.3122, 6);
    expect(odds.map((o) => o.prize)).toEqual([100, 20, 10, 5, 2, 1]);
    const total = PRIZE_WEIGHTS.reduce((sum, p) => sum + p.weight, 0);
    expect(odds[0]!.chance).toBeCloseTo(12 / total, 10);
  });
});

describe('CoverageGrid', () => {
  it('starts empty and marks the cells under a brush dab', () => {
    const grid = new CoverageGrid(100, 100, 10, 10);
    expect(grid.coverage).toBe(0);
    // A dab at the centre of cell (2, 2) with a radius smaller than a cell covers just that cell.
    expect(grid.stamp(25, 25, 25, 25, 4)).toBe(1);
    expect(grid.coverage).toBeCloseTo(0.01);
  });

  it('covers the whole path of a drag, not just its ends', () => {
    const grid = new CoverageGrid(100, 100, 10, 10);
    grid.stamp(5, 55, 95, 55, 4); // a horizontal stroke through row 5
    expect(grid.coverageIn({ x: 0, y: 50, width: 100, height: 10 })).toBe(1);
    expect(grid.coverageIn({ x: 0, y: 0, width: 100, height: 50 })).toBe(0);
    expect(grid.coverage).toBeCloseTo(0.1);
  });

  it('does not count the same cell twice', () => {
    const grid = new CoverageGrid(100, 100, 10, 10);
    const first = grid.stamp(0, 0, 100, 100, 12);
    expect(grid.stamp(0, 0, 100, 100, 12)).toBe(0);
    expect(grid.coverage).toBeCloseTo(first / 100);
  });

  it('ignores the part of a stroke that leaves the card', () => {
    const grid = new CoverageGrid(100, 100, 10, 10);
    expect(() => grid.stamp(-500, -500, 600, 600, 30)).not.toThrow();
    expect(grid.coverage).toBeGreaterThan(0);
    expect(grid.coverage).toBeLessThanOrEqual(1);
  });

  it('measures one region of the card on its own', () => {
    const grid = new CoverageGrid(90, 90, 9, 9);
    // Fill the top-left 3×3-cell region, one stroke along each row of cell centres.
    for (let y = 5; y < 30; y += 10) grid.stamp(5, y, 25, y, 4);
    expect(grid.coverageIn({ x: 0, y: 0, width: 30, height: 30 })).toBe(1);
    expect(grid.coverageIn({ x: 30, y: 0, width: 30, height: 30 })).toBe(0);
  });

  it('resets', () => {
    const grid = new CoverageGrid(100, 100, 10, 10);
    grid.stamp(0, 0, 100, 100, 20);
    grid.reset();
    expect(grid.coverage).toBe(0);
  });
});

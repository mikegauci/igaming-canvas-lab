import { createRng } from '@lab/core/logic';
import { describe, expect, it } from 'vitest';
import { PAYTABLE, REEL_STRIPS, type SymbolId } from './config';
import { evaluate, gridAt, resolveSpin, totalWin, type Grid } from './evaluate';
import { exactStats } from './stats';

/** Builds a grid from rows as you'd see them on screen (row-major), returning grid[reel][row]. */
const fromRows = (...rows: SymbolId[][]): Grid =>
  rows[0]!.map((_, reel) => rows.map((r) => r[reel]!));

describe('gridAt', () => {
  it('shows the stop and the symbols after it on each strip', () => {
    const grid = gridAt([0, 0, 0]);
    REEL_STRIPS.forEach((strip, reel) => expect(grid[reel]).toEqual(strip.slice(0, 3)));
  });

  it('wraps around the end of a strip', () => {
    const strip = REEL_STRIPS[0]!;
    const last = strip.length - 1;
    expect(gridAt([last, 0, 0])[0]).toEqual([strip[last], strip[0], strip[1]]);
  });
});

describe('evaluate', () => {
  it('pays three of a kind on the middle line', () => {
    const grid = fromRows(
      ['lemon', 'bell', 'bar'],
      ['seven', 'seven', 'seven'],
      ['bar', 'cherry', 'lemon'],
    );
    expect(evaluate(grid, 2)).toEqual([{ line: 0, symbol: 'seven', payout: PAYTABLE.seven * 2 }]);
  });

  it('pays both diagonals', () => {
    const grid = fromRows(
      ['bell', 'lemon', 'bell'],
      ['lemon', 'bell', 'lemon'],
      ['bell', 'lemon', 'bell'],
    );
    const wins = evaluate(grid, 1);
    expect(wins.map((w) => w.line)).toEqual([3, 4]);
    expect(totalWin(wins)).toBe(PAYTABLE.bell * 2);
  });

  it('pays nothing for two of a kind', () => {
    const grid = fromRows(
      ['cherry', 'cherry', 'lemon'],
      ['bar', 'bar', 'bell'],
      ['seven', 'seven', 'diamond'],
    );
    expect(evaluate(grid, 1)).toEqual([]);
  });

  it('can pay every line at once', () => {
    const row: SymbolId[] = ['diamond', 'diamond', 'diamond'];
    expect(totalWin(evaluate(fromRows(row, row, row), 1))).toBe(PAYTABLE.diamond * 5);
  });
});

describe('resolveSpin', () => {
  it('is deterministic for a seed and pays what the grid shows', () => {
    const a = createRng(5);
    const b = createRng(5);
    for (let i = 0; i < 50; i++) {
      const round = resolveSpin({ bet: 25 }, a);
      expect(resolveSpin({ bet: 25 }, b)).toEqual(round);
      expect(round.outcome.grid).toEqual(gridAt(round.outcome.stops));
      expect(round.win).toBe(totalWin(evaluate(round.outcome.grid, 5)));
    }
  });

  it('can land on every stop of every reel, roughly equally often', () => {
    const rng = createRng(9);
    const perStop = 2000;
    const counts = REEL_STRIPS.map((strip) => new Array<number>(strip.length).fill(0));
    for (let i = 0; i < perStop * REEL_STRIPS[0]!.length; i++) {
      resolveSpin({ bet: 5 }, rng).outcome.stops.forEach((stop, reel) => counts[reel]![stop]!++);
    }
    for (const reel of counts) {
      for (const count of reel) {
        expect(count).toBeGreaterThan(perStop * 0.85);
        expect(count).toBeLessThan(perStop * 1.15);
      }
    }
  });

  it('rejects bets that do not split evenly across the lines', () => {
    expect(() => resolveSpin({ bet: 7 }, createRng(1))).toThrow(RangeError);
  });
});

describe('slot maths', () => {
  const stats = exactStats();

  it('has an RTP between 95% and 97%', () => {
    expect(stats.rtp).toBeGreaterThan(0.95);
    expect(stats.rtp).toBeLessThan(0.97);
  });

  it('pays on roughly one spin in five', () => {
    expect(stats.hitRate).toBeGreaterThan(0.18);
    expect(stats.hitRate).toBeLessThan(0.25);
  });

  it('agrees with a long seeded simulation, within 4 standard errors', () => {
    const rng = createRng(2024);
    const spins = 200_000;
    let sum = 0;
    let sumOfSquares = 0;
    for (let i = 0; i < spins; i++) {
      const returned = resolveSpin({ bet: 5 }, rng).win / 5;
      sum += returned;
      sumOfSquares += returned * returned;
    }
    const mean = sum / spins;
    const standardError = Math.sqrt((sumOfSquares / spins - mean * mean) / spins);
    expect(Math.abs(mean - stats.rtp)).toBeLessThan(4 * standardError);
    // Long statistical run: allow for slow or busy CI machines.
  }, 30_000);
});

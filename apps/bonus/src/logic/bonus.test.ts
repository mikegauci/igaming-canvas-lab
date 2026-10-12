import { createRng } from '@lab/core/logic';
import { describe, expect, it } from 'vitest';
import { exactStats, forcedResolver, PRIZES, resolveBonus } from './prizes';
import { FINAL_HOLD_SECONDS, planCountUp, tierFor, TIER_STEP_SECONDS } from './tiers';

describe('prizes', () => {
  it('has an RTP of 97%, pays on 63% of picks and gives a BIG WIN or better on 2%', () => {
    const stats = exactStats();
    expect(stats.rtp).toBeCloseTo(0.97, 10);
    expect(stats.hitRate).toBeCloseTo(0.6302, 10);
    expect(stats.bigWinRate).toBeCloseTo(0.0202, 10);
  });

  it('keeps every win a whole number of credits at every stake', () => {
    for (const bet of [2, 4, 10, 20, 50, 100, 200]) {
      for (const { multiplier } of PRIZES) expect(Number.isInteger(bet * multiplier)).toBe(true);
    }
  });

  it('resolves deterministically and pays stake × multiplier', () => {
    const a = createRng(8);
    const b = createRng(8);
    for (let i = 0; i < 200; i++) {
      const round = resolveBonus({ bet: 10 }, a);
      expect(resolveBonus({ bet: 10 }, b)).toEqual(round);
      expect(round.win).toBe(10 * round.outcome.multiplier);
      for (const m of [round.outcome.multiplier, ...round.outcome.others]) {
        expect(PRIZES.map((p) => p.multiplier)).toContain(m);
      }
    }
  });

  it('draws prizes as often as their weights say', () => {
    const rng = createRng(19);
    const picks = 100_000;
    const counts = new Map<number, number>();
    for (let i = 0; i < picks; i++) {
      const { multiplier } = resolveBonus({ bet: 2 }, rng).outcome;
      counts.set(multiplier, (counts.get(multiplier) ?? 0) + 1);
    }
    const total = PRIZES.reduce((sum, p) => sum + p.weight, 0);
    for (const { multiplier, weight } of PRIZES) {
      const p = weight / total;
      expect(Math.abs((counts.get(multiplier) ?? 0) - picks * p)).toBeLessThan(
        5 * Math.sqrt(picks * p * (1 - p)),
      );
    }
  }, 30_000);

  it('forces the requested prize for the showcase mode', () => {
    const round = forcedResolver(50)({ bet: 4 }, createRng(1));
    expect(round.outcome.multiplier).toBe(50);
    expect(round.win).toBe(200);
  });
});

describe('tierFor', () => {
  it('maps multiples of the stake to tiers', () => {
    expect(tierFor(90, 10)).toBeNull();
    expect(tierFor(100, 10)).toBe('BIG');
    expect(tierFor(249, 10)).toBe('BIG');
    expect(tierFor(250, 10)).toBe('MEGA');
    expect(tierFor(500, 10)).toBe('EPIC');
    expect(tierFor(5000, 10)).toBe('EPIC');
  });
});

describe('planCountUp', () => {
  it('counts an ordinary win straight up', () => {
    const steps = planCountUp(20, 10);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ tier: null, from: 0, to: 20 });
  });

  it('plans nothing for no win', () => {
    expect(planCountUp(0, 10)).toEqual([]);
  });

  it('upgrades the banner at each threshold and ends exactly on the win', () => {
    const steps = planCountUp(500, 10); // 50×: EPIC
    expect(steps.map((s) => s.tier)).toEqual(['BIG', 'MEGA', 'EPIC']);
    expect(steps.map((s) => [s.from, s.to])).toEqual([
      [0, 250],
      [250, 500],
      [500, 500],
    ]);
  });

  it('stops at the tier the win actually reaches', () => {
    const steps = planCountUp(300, 10); // 30×: MEGA
    expect(steps.map((s) => s.tier)).toEqual(['BIG', 'MEGA']);
    expect(steps.at(-1)!.to).toBe(300);
  });

  it('is contiguous, never counts down and holds the last step a little longer', () => {
    for (const win of [100, 260, 499, 500, 1234]) {
      const steps = planCountUp(win, 10);
      steps.forEach((step, i) => {
        expect(step.to).toBeGreaterThanOrEqual(step.from);
        if (i > 0) expect(step.from).toBe(steps[i - 1]!.to);
      });
      expect(steps.at(-1)!.to).toBe(win);
      expect(steps.at(-1)!.duration).toBe(TIER_STEP_SECONDS + FINAL_HOLD_SECONDS);
    }
  });
});

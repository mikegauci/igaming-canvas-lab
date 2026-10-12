import { createRng } from '@lab/core/logic';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chanceToReach,
  crashPointFrom,
  multiplierAt,
  RTP,
  secondsToReach,
  settleCashOut,
  toCents,
} from './crash';
import { MockCrashServer, type RoundEvents } from './server';

describe('crash maths', () => {
  it('crashes instantly at 1.00× on low draws and grows without bound on high ones', () => {
    expect(crashPointFrom(0)).toBe(1);
    expect(crashPointFrom(0.02)).toBe(1);
    expect(crashPointFrom(0.5)).toBe(1.94);
    expect(crashPointFrom(0.75)).toBe(3.88);
    expect(crashPointFrom(0.999999)).toBeGreaterThan(900_000);
  });

  it('reaches each multiplier as often as the formula says', () => {
    const rng = createRng(31);
    const rounds = 200_000;
    const points = Array.from({ length: rounds }, () => crashPointFrom(rng.next()));
    for (const target of [1.01, 1.5, 2, 5, 10]) {
      const reached = points.filter((p) => p >= target).length / rounds;
      const expected = chanceToReach(target);
      const se = Math.sqrt((expected * (1 - expected)) / rounds);
      expect(Math.abs(reached - expected)).toBeLessThan(5 * se);
    }
    // Everything that would land below 1.01× busts at once: 1 − RTP / 1.01 ≈ 4% of rounds.
    const instant = points.filter((p) => p === 1).length / rounds;
    expect(instant).toBeCloseTo(1 - chanceToReach(1.01), 2);
  }, 30_000);

  it('inverts the growth curve', () => {
    for (const m of [1, 1.5, 2, 10, 100]) expect(multiplierAt(secondsToReach(m))).toBeCloseTo(m, 9);
    expect(multiplierAt(0)).toBe(1);
    expect(multiplierAt(-1)).toBe(1);
  });

  it('rounds multipliers down to whole hundredths', () => {
    expect(toCents(1.999)).toBe(1.99);
    expect(toCents(2)).toBe(2);
    expect(toCents(Math.exp(Math.log(2)))).toBe(2);
  });

  it('pays a cash-out before the crash and refuses one at or after it', () => {
    const at = (m: number) => secondsToReach(m) + 1e-6;
    expect(settleCashOut(3, at(2), 10)).toEqual({ cashedOut: true, multiplier: 2, win: 20 });
    expect(settleCashOut(3, at(1.55), 7)).toEqual({ cashedOut: true, multiplier: 1.55, win: 10 });
    expect(settleCashOut(3, at(3), 10)).toEqual({ cashedOut: false, crashPoint: 3 });
    expect(settleCashOut(1, 0, 10)).toEqual({ cashedOut: false, crashPoint: 1 });
  });

  it('returns about RTP × target / (target + 0.01) for a fixed auto cash-out', () => {
    const rng = createRng(77);
    const rounds = 200_000;
    const target = 2;
    let returned = 0;
    for (let i = 0; i < rounds; i++) {
      if (crashPointFrom(rng.next()) > target) returned += target;
    }
    expect(returned / rounds).toBeCloseTo((RTP * target) / (target + 0.01), 2);
  }, 30_000);
});

describe('MockCrashServer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const clock = { now: () => Date.now() };
  const events = (): RoundEvents & { crashed: number[]; cashed: number[] } => {
    const crashed: number[] = [];
    const cashed: number[] = [];
    return {
      crashed,
      cashed,
      onCrash: (p) => crashed.push(p),
      onCashOut: (s) => cashed.push(s.multiplier),
    };
  };
  /** First seed whose round runs past `min` (so tests can cash out mid-flight). */
  const seedReaching = (min: number) => {
    for (let seed = 1; ; seed++) {
      if (crashPointFrom(createRng(seed).next()) >= min) return seed;
    }
  };

  it('pushes the crash at the drawn point and keeps it secret until then', async () => {
    const seed = seedReaching(3);
    const crashPoint = crashPointFrom(createRng(seed).next());
    const server = new MockCrashServer({ seed, latency: [0, 0], clock });
    const ev = events();
    const start = server.start(10, ev);
    await vi.advanceTimersByTimeAsync(1);
    await start;

    await vi.advanceTimersByTimeAsync(secondsToReach(crashPoint) * 1000 - 50);
    expect(ev.crashed).toEqual([]);
    await vi.advanceTimersByTimeAsync(100);
    expect(ev.crashed).toEqual([crashPoint]);
  });

  it('judges cash-outs on its own clock, so network delay counts against the player', async () => {
    const seed = seedReaching(3);
    const crashPoint = crashPointFrom(createRng(seed).next());
    const crashAtMs = secondsToReach(crashPoint) * 1000;
    // 200 ms each way: a request sent 100 ms before the crash arrives 100 ms too late.
    const server = new MockCrashServer({ seed, latency: [200, 200], clock });
    const ev = events();
    const start = server.start(10, ev);
    await vi.advanceTimersByTimeAsync(400);
    const { roundId } = await start;

    // The round started on the server when the first message arrived, 200 ms ago.
    await vi.advanceTimersByTimeAsync(crashAtMs - 200 - 100);
    const late = server.cashOut(roundId);
    await vi.advanceTimersByTimeAsync(400);
    expect(await late).toEqual({ cashedOut: false, crashPoint });
  });

  it('pays a timely cash-out at the multiplier the server saw, and only once', async () => {
    const seed = seedReaching(3);
    const server = new MockCrashServer({ seed, latency: [50, 50], clock });
    const ev = events();
    const start = server.start(10, ev);
    await vi.advanceTimersByTimeAsync(100);
    const { roundId } = await start;

    // Server time when the request lands: 50 ms (ack) + wait + 50 ms (request) after start.
    const waitMs = secondsToReach(2) * 1000 - 100 + 5;
    await vi.advanceTimersByTimeAsync(waitMs);
    const first = server.cashOut(roundId);
    await vi.advanceTimersByTimeAsync(100);
    expect(await first).toEqual({ cashedOut: true, multiplier: 2, win: 20 });

    const again = server.cashOut(roundId);
    await vi.advanceTimersByTimeAsync(100);
    expect(await again).toEqual({ cashedOut: true, multiplier: 2, win: 20 });
  });

  it('settles an auto cash-out on the server and pushes it', async () => {
    const seed = seedReaching(2.5);
    const server = new MockCrashServer({ seed, latency: [0, 0], clock });
    const ev = events();
    const start = server.start(10, ev, 2);
    await vi.advanceTimersByTimeAsync(1);
    await start;
    await vi.advanceTimersByTimeAsync(secondsToReach(2) * 1000 + 10);
    expect(ev.cashed).toEqual([2]);
  });

  it('does not auto cash out when the round crashes first', async () => {
    const seed = seedReaching(1.2);
    const crashPoint = crashPointFrom(createRng(seed).next());
    const server = new MockCrashServer({ seed, latency: [0, 0], clock });
    const ev = events();
    const start = server.start(10, ev, crashPoint + 1);
    await vi.advanceTimersByTimeAsync(1);
    await start;
    await vi.advanceTimersByTimeAsync(secondsToReach(crashPoint + 1) * 1000 + 100);
    expect(ev.cashed).toEqual([]);
    expect(ev.crashed).toEqual([crashPoint]);
  });

  it('rejects invalid bets', async () => {
    const server = new MockCrashServer({ seed: 1, latency: [0, 0], clock });
    await expect(server.start(0, events())).rejects.toThrow(RangeError);
  });
});

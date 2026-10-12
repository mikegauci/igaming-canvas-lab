import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockOutcomeServer, type Resolver } from './outcome';

// Coin flip: heads pays 2× the bet.
const coinFlip: Resolver<{ bet: number }, 'heads' | 'tails'> = ({ bet }, rng) => {
  const outcome = rng.next() < 0.5 ? 'heads' : 'tails';
  return { outcome, win: outcome === 'heads' ? bet * 2 : 0 };
};

const playMany = async (server: MockOutcomeServer<{ bet: number }, string>, n: number) => {
  const results = [];
  for (let i = 0; i < n; i++) results.push(await server.play({ bet: 10 }));
  return results;
};

describe('MockOutcomeServer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('only resolves after the simulated latency', async () => {
    const server = new MockOutcomeServer(coinFlip, { seed: 1, latency: [300, 300] });
    const settled = vi.fn();
    void server.play({ bet: 10 }).then(settled);

    await vi.advanceTimersByTimeAsync(299);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledOnce();
  });

  it('produces the same rounds for the same seed, whatever the latency', async () => {
    const fast = new MockOutcomeServer(coinFlip, { seed: 7, latency: [0, 0] });
    const slow = new MockOutcomeServer(coinFlip, { seed: 7, latency: [100, 900] });

    const fastRounds = playMany(fast, 10);
    const slowRounds = playMany(slow, 10);
    await vi.runAllTimersAsync();

    expect(await slowRounds).toEqual(await fastRounds);
  });

  it('returns the resolver payout with sequential round ids', async () => {
    const server = new MockOutcomeServer(coinFlip, { seed: 3, latency: [0, 0] });
    const [first, second] = await playMany(server, 2);

    expect(first!.roundId).toBe('r-000001');
    expect(second!.roundId).toBe('r-000002');
    for (const round of [first!, second!]) {
      expect(round.bet).toBe(10);
      expect(round.win).toBe(round.outcome === 'heads' ? 20 : 0);
    }
  });

  it('rejects invalid bets before resolving anything', async () => {
    const resolver = vi.fn(coinFlip);
    const server = new MockOutcomeServer(resolver, { seed: 1, latency: [0, 0] });

    await expect(server.play({ bet: 0 })).rejects.toThrow(RangeError);
    await expect(server.play({ bet: 2.5 })).rejects.toThrow(RangeError);
    expect(resolver).not.toHaveBeenCalled();
  });
});

import { createRng, type Rng } from '@lab/core/logic';
import { crashPointFrom, secondsToReach, settleCashOut, type Settlement } from './crash';

export interface Clock {
  /** Milliseconds, monotonic. */
  now(): number;
}

export interface CrashServerOptions {
  seed: number;
  /** One-way network delay in ms, picked uniformly from [min, max] for each message. */
  latency?: readonly [min: number, max: number];
  clock?: Clock;
}

export interface RoundStarted {
  roundId: string;
}

export interface RoundEvents {
  /** The round crashed at this multiplier (pushed by the server). */
  onCrash: (crashPoint: number) => void;
  /** An auto cash-out (or a manual one) was settled in the player's favour. */
  onCashOut: (settlement: Extract<Settlement, { cashedOut: true }>) => void;
}

interface LiveRound {
  bet: number;
  crashPoint: number;
  startedAt: number;
  /** Final verdict once known; later requests get the same answer. */
  settlement: Settlement | null;
  events: RoundEvents;
  timers: ReturnType<typeof setTimeout>[];
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Stand-in for a crash game server. It draws the crash point when the round starts and keeps it
 * secret; the client only learns it when the crash is pushed. Cash-outs are judged on the
 * server's clock when the request arrives, so network delay counts against the player, just like
 * the real thing: the animation on screen is never the authority.
 */
export class MockCrashServer {
  private readonly rng: Rng;
  private readonly latencyRng: Rng;
  private readonly latency: readonly [number, number];
  private readonly clock: Clock;
  private readonly rounds = new Map<string, LiveRound>();
  private count = 0;

  constructor({ seed, latency = [40, 120], clock = performance }: CrashServerOptions) {
    this.rng = createRng(seed);
    this.latencyRng = createRng(seed ^ 0x5bd1e995);
    this.latency = latency;
    this.clock = clock;
  }

  /**
   * Starts a round for `bet`. Resolves (after the network delay) once the round is running on the
   * server; the client should start its multiplier from that moment.
   */
  async start(
    bet: number,
    events: RoundEvents,
    autoCashOut: number | null = null,
  ): Promise<RoundStarted> {
    if (!Number.isInteger(bet) || bet <= 0) throw new RangeError(`Invalid bet: ${bet}`);
    await wait(this.delay());

    const roundId = `c-${String(++this.count).padStart(6, '0')}`;
    const round: LiveRound = {
      bet,
      crashPoint: crashPointFrom(this.rng.next()),
      startedAt: this.clock.now(),
      settlement: null,
      events,
      timers: [],
    };
    this.rounds.set(roundId, round);

    const crashIn = secondsToReach(round.crashPoint) * 1000;
    round.timers.push(setTimeout(() => this.crash(roundId), crashIn));
    if (autoCashOut !== null && autoCashOut > 1) {
      // Fires a hair after the target so the multiplier has really reached it.
      const at = secondsToReach(autoCashOut) * 1000 + 1;
      if (at < crashIn) {
        round.timers.push(setTimeout(() => this.settleAuto(roundId, autoCashOut), at));
      }
    }

    // The start acknowledgement travels back to the client too.
    await wait(this.delay());
    return { roundId };
  }

  /** Asks to cash out now. Resolves with the server's verdict after the round trip. */
  async cashOut(roundId: string): Promise<Settlement> {
    await wait(this.delay());
    const verdict = this.settle(roundId);
    await wait(this.delay());
    return verdict;
  }

  private settle(roundId: string): Settlement {
    const round = this.rounds.get(roundId);
    if (!round) throw new Error(`Unknown round ${roundId}`);
    if (round.settlement) return round.settlement;

    const elapsed = (this.clock.now() - round.startedAt) / 1000;
    round.settlement = settleCashOut(round.crashPoint, elapsed, round.bet);
    return round.settlement;
  }

  /**
   * An auto cash-out pays exactly its target, which is only scheduled below the crash point: a
   * timer that fires late (throttled tab, busy thread) must not change the verdict.
   */
  private settleAuto(roundId: string, target: number) {
    const round = this.rounds.get(roundId);
    if (!round || round.settlement) return;
    const verdict = {
      cashedOut: true as const,
      multiplier: target,
      win: Math.floor(round.bet * target),
    };
    round.settlement = verdict;
    setTimeout(() => round.events.onCashOut(verdict), this.delay());
  }

  private crash(roundId: string) {
    const round = this.rounds.get(roundId);
    if (!round) return;
    round.settlement ??= { cashedOut: false, crashPoint: round.crashPoint };
    round.timers.forEach(clearTimeout);
    setTimeout(() => {
      round.events.onCrash(round.crashPoint);
      // A cash-out the client sent before it heard of the crash can still be in flight: keep the
      // round for one more trip, then forget it.
      setTimeout(() => this.rounds.delete(roundId), this.latency[1]);
    }, this.delay());
  }

  private delay(): number {
    const [min, max] = this.latency;
    return min + this.latencyRng.next() * (max - min);
  }
}

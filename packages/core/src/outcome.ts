import { createRng, type Rng } from './rng';

export interface RoundRequest {
  bet: number;
}

export interface RoundResult<TOutcome> {
  roundId: string;
  bet: number;
  win: number;
  outcome: TOutcome;
}

/**
 * The client asks for a round and gets back a finished result. In production this is a server
 * call: the outcome is decided there, and the client only animates towards it.
 */
export interface OutcomeService<TRequest extends RoundRequest, TOutcome> {
  play(request: TRequest): Promise<RoundResult<TOutcome>>;
}

/** Pure game maths for one round: given a request and randomness, decide outcome and payout. */
export type Resolver<TRequest extends RoundRequest, TOutcome> = (
  request: TRequest,
  rng: Rng,
) => { outcome: TOutcome; win: number };

export interface MockServerOptions {
  seed: number;
  /** Simulated round-trip time in ms, picked uniformly from [min, max]. */
  latency?: readonly [min: number, max: number];
}

/** Stand-in for a game server: seeded RNG, game maths via a resolver, and fake network latency. */
export class MockOutcomeServer<TRequest extends RoundRequest, TOutcome> implements OutcomeService<
  TRequest,
  TOutcome
> {
  private readonly rng: Rng;
  // Separate stream so changing latency settings never changes the outcome sequence.
  private readonly latencyRng: Rng;
  private readonly latency: readonly [number, number];
  private rounds = 0;

  constructor(
    private readonly resolve: Resolver<TRequest, TOutcome>,
    { seed, latency = [250, 600] }: MockServerOptions,
  ) {
    this.rng = createRng(seed);
    this.latencyRng = createRng(seed ^ 0x9e3779b9);
    this.latency = latency;
  }

  async play(request: TRequest): Promise<RoundResult<TOutcome>> {
    if (!Number.isInteger(request.bet) || request.bet <= 0) {
      throw new RangeError(`Invalid bet: ${request.bet}`);
    }
    const { outcome, win } = this.resolve(request, this.rng);
    const roundId = `r-${String(++this.rounds).padStart(6, '0')}`;

    const [min, max] = this.latency;
    const delay = min + this.latencyRng.next() * (max - min);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    return { roundId, bet: request.bet, win, outcome };
  }
}

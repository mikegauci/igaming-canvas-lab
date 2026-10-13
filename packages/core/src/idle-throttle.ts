/** Frame cap while a game sits between rounds: ambient loops still read smoothly at this rate. */
export const IDLE_FPS = 30;
/** How long without input, between rounds, before the cap applies. */
export const IDLE_AFTER_MS = 3000;

/** The part of Pixi's Ticker this needs (0 means uncapped). */
export interface FrameCap {
  maxFPS: number;
}

/**
 * Halves the frame rate while nothing is happening, to save battery on phones: between rounds
 * and with no input for a few seconds, only the attract loops are moving. Any input, or the
 * scene leaving its idle state, restores the full rate on the next frame.
 */
export class IdleThrottle {
  private lastInput: number;

  constructor(
    private readonly ticker: FrameCap,
    private readonly isIdle: () => boolean,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.lastInput = now();
  }

  /** Call on any user input. */
  poke(): void {
    this.lastInput = this.now();
    this.set(0);
  }

  /** Call once per frame. */
  tick(): void {
    const quiet = this.now() - this.lastInput >= IDLE_AFTER_MS;
    this.set(quiet && this.isIdle() ? IDLE_FPS : 0);
  }

  private set(fps: number) {
    if (this.ticker.maxFPS !== fps) this.ticker.maxFPS = fps;
  }
}

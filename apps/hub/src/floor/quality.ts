export type QualityTier = 'high' | 'medium' | 'low';

export interface QualitySettings {
  tier: QualityTier;
  /** Cap on devicePixelRatio: fill rate is the first thing to go on phones. */
  maxResolution: number;
  /** CRT pass (curvature, scanlines) on the cabinet screens: five small filter passes. */
  crt: boolean;
  /**
   * Blur passes in the full-screen bloom; 0 turns post-processing off. Bloom always renders at the
   * screen's resolution (a lower one would blur the whole floor), so fewer passes is how it gets
   * cheaper.
   */
  bloomPasses: number;
  /** Share of the full particle budget (the drifting motes). */
  particles: number;
}

const TIERS: Record<QualityTier, QualitySettings> = {
  high: { tier: 'high', maxResolution: 2, crt: true, bloomPasses: 5, particles: 1 },
  medium: { tier: 'medium', maxResolution: 2, crt: true, bloomPasses: 3, particles: 0.6 },
  low: { tier: 'low', maxResolution: 1.5, crt: false, bloomPasses: 0, particles: 0.25 },
};

const ORDER: QualityTier[] = ['high', 'medium', 'low'];

const isTier = (value: unknown): value is QualityTier => ORDER.includes(value as QualityTier);

/** The tier pinned by `?quality=high|medium|low`, if any. */
export function pinnedTier(search: string): QualityTier | null {
  const requested = new URLSearchParams(search).get('quality');
  return isTier(requested) ? requested : null;
}

export interface DeviceHints {
  cores?: number;
  /** GiB, from navigator.deviceMemory (Chromium only). */
  memory?: number;
  coarsePointer?: boolean;
}

/**
 * First guess from the hardware: weak devices start low instead of stuttering into it. Missing
 * hints (Safari and Firefox hide deviceMemory) count as capable, and a low core count only means
 * medium, since privacy modes report fake ones; the frame-time check catches the rest.
 */
export function guessTier({
  cores = 8,
  memory = 8,
  coarsePointer = false,
}: DeviceHints): QualityTier {
  if (memory <= 2) return 'low';
  if (coarsePointer || cores <= 4 || memory <= 4) return 'medium';
  return 'high';
}

/** Time at the start that is ignored: shader compiles and texture uploads skew it. */
const WARMUP_MS = 1500;
/** Frame time averaged per verdict: time-based, so a device at 3 fps isn't judged 20× slower. */
const WINDOW_MS = 2000;
/** Average frame time that counts as too slow (under ~48 fps)... */
const SLOW_FRAME_MS = 1000 / 48;
/** ...unless the frames are steady: a 30 fps cap (iOS Low Power Mode, energy savers) is a choice. */
const STEADY_VARIATION = 0.15;
/** Below ~25 fps it's too slow however steady it is. */
const TOO_SLOW_MS = 40;
/** One frame counts for at most this much, so a GC pause or hitch doesn't decide a window alone. */
const MAX_FRAME_MS = 250;

/**
 * The floor's quality tier. Starts from a hardware guess (or `?quality=` in the URL), then watches
 * frame times and steps down one tier at a time while the average stays slow and jittery. It never
 * steps back up, so it can't oscillate between tiers.
 */
export class Quality {
  private current: QualityTier;
  private readonly locked: boolean;
  private readonly listeners: ((settings: QualitySettings) => void)[] = [];
  private warmup = WARMUP_MS;
  private total = 0;
  private squares = 0;
  private count = 0;

  constructor(tier: QualityTier, locked = false) {
    this.current = tier;
    this.locked = locked;
  }

  static fromEnvironment(): Quality {
    const pinned = pinnedTier(window.location.search);
    if (pinned) return new Quality(pinned, true);
    const nav = navigator as Navigator & { deviceMemory?: number };
    return new Quality(
      guessTier({
        cores: nav.hardwareConcurrency,
        memory: nav.deviceMemory,
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      }),
    );
  }

  get tier(): QualityTier {
    return this.current;
  }

  get settings(): QualitySettings {
    return TIERS[this.current];
  }

  onChange(listener: (settings: QualitySettings) => void): void {
    this.listeners.push(listener);
  }

  /** Feed one frame's raw duration (ticker.elapsedMS; deltaMS is clamped by Pixi). */
  sample(elapsedMS: number): void {
    if (this.locked || this.current === 'low') return;
    const ms = Math.min(elapsedMS, MAX_FRAME_MS);
    if (this.warmup > 0) {
      this.warmup -= ms;
      return;
    }
    this.total += ms;
    this.squares += ms * ms;
    this.count++;
    if (this.total < WINDOW_MS) return;
    const mean = this.total / this.count;
    const variation = Math.sqrt(Math.max(0, this.squares / this.count - mean * mean)) / mean;
    this.total = 0;
    this.squares = 0;
    this.count = 0;
    if (mean > TOO_SLOW_MS || (mean > SLOW_FRAME_MS && variation > STEADY_VARIATION)) {
      this.stepDown();
    }
  }

  private stepDown() {
    this.current = ORDER[ORDER.indexOf(this.current) + 1]!;
    // Let the cheaper tier settle before judging it.
    this.warmup = WARMUP_MS;
    for (const listener of this.listeners) listener(this.settings);
  }
}

export type QualityTier = 'high' | 'medium' | 'low';

export interface QualitySettings {
  tier: QualityTier;
  /** Cap on devicePixelRatio: fill rate is the first thing to go on phones. */
  maxResolution: number;
  /** Full-screen bloom pass. */
  bloom: boolean;
  /** CRT curvature and scanlines on the cabinet screens. */
  crt: boolean;
  /** Share of the full particle budget (dust, sparkles). */
  particles: number;
}

const TIERS: Record<QualityTier, QualitySettings> = {
  high: { tier: 'high', maxResolution: 2, bloom: true, crt: true, particles: 1 },
  medium: { tier: 'medium', maxResolution: 1.5, bloom: true, crt: false, particles: 0.5 },
  low: { tier: 'low', maxResolution: 1, bloom: false, crt: false, particles: 0.25 },
};

const ORDER: QualityTier[] = ['high', 'medium', 'low'];

const isTier = (value: unknown): value is QualityTier => ORDER.includes(value as QualityTier);

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

/** Frames at the start that are ignored: shader compiles and texture uploads skew them. */
const WARMUP_FRAMES = 90;
/** Frames averaged per verdict (about 2 s at 60 fps). */
const WINDOW_FRAMES = 120;
/** Average frame time that counts as too slow (under ~48 fps). */
const SLOW_FRAME_MS = 1000 / 48;
/** Longer frames are hitches (tab switch, GC), not a steady load: they are skipped. */
const HITCH_MS = 250;

/**
 * The floor's quality tier. Starts from a hardware guess (or `?quality=` in the URL), then watches
 * frame times and steps down one tier at a time while the average stays slow. It never steps back
 * up, so it can't oscillate between tiers.
 */
export class Quality {
  private current: QualityTier;
  private readonly locked: boolean;
  private readonly listeners: ((settings: QualitySettings) => void)[] = [];
  private seen = 0;
  private total = 0;
  private count = 0;

  constructor(tier: QualityTier, locked = false) {
    this.current = tier;
    this.locked = locked;
  }

  /** `?quality=high|medium|low` pins the tier; otherwise the device is guessed from. */
  static fromEnvironment(): Quality {
    const requested = new URLSearchParams(window.location.search).get('quality');
    if (isTier(requested)) return new Quality(requested, true);
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

  /** Feed one frame's duration (ticker.elapsedMS). */
  sample(deltaMS: number): void {
    if (this.locked || this.current === 'low' || deltaMS > HITCH_MS) return;
    if (++this.seen <= WARMUP_FRAMES) return;
    this.total += deltaMS;
    if (++this.count < WINDOW_FRAMES) return;
    const average = this.total / this.count;
    this.total = 0;
    this.count = 0;
    if (average > SLOW_FRAME_MS) this.stepDown();
  }

  private stepDown() {
    this.current = ORDER[ORDER.indexOf(this.current) + 1]!;
    // Let the cheaper tier settle before judging it.
    this.seen = 0;
    for (const listener of this.listeners) listener(this.settings);
  }
}

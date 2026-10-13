import { gsap } from 'gsap';
import { Container, type Ticker } from 'pixi.js';

/** A rectangle in design coordinates. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The design-space area a scene lays itself out in. Switches when the device rotates. */
export interface Viewport {
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait';
  /**
   * The whole window in design coordinates. It contains the design area and also covers the
   * letterbox bars, so backgrounds and dimming layers drawn to it fill the screen at any size.
   */
  screen: Bounds;
}

/** A screen of the game (loading, play, bonus…). All hooks are optional. */
export abstract class Scene extends Container {
  /** Runs once the scene is on stage, before it fades in. Await asset loads here. */
  enter?(): void | Promise<void>;
  /** Runs after the scene has faded out, before it is removed. */
  exit?(): void | Promise<void>;
  /** Called every frame while this is the current scene. */
  update?(ticker: Ticker): void;
  /** Called on enter and whenever the viewport changes size or orientation. */
  resize?(viewport: Viewport): void;
}

export interface ChangeOptions {
  /** Fade duration in seconds for each half of the transition. */
  fade?: number;
  /** Set false to keep the old scene alive for reuse. */
  destroyPrevious?: boolean;
}

export class SceneManager {
  private current: Scene | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly root: Container,
    ticker: Ticker,
    private viewport: Viewport,
  ) {
    ticker.add((t) => this.current?.update?.(t));
  }

  get scene(): Scene | null {
    return this.current;
  }

  /** Fades out the current scene and fades in `next`. Calls are queued, never overlapped. */
  change(next: Scene, options: ChangeOptions = {}): Promise<void> {
    const run = this.queue.then(() => this.swap(next, options));
    this.queue = run.catch(() => undefined);
    return run;
  }

  resize(viewport: Viewport): void {
    this.viewport = viewport;
    this.current?.resize?.(viewport);
  }

  private async swap(next: Scene, { fade = 0.3, destroyPrevious = true }: ChangeOptions) {
    const prev = this.current;
    if (prev) {
      await gsap.to(prev, { alpha: 0, duration: fade });
      await prev.exit?.();
      this.root.removeChild(prev);
      if (destroyPrevious) prev.destroy({ children: true });
    }

    next.alpha = 0;
    this.root.addChild(next);
    this.current = next;
    next.resize?.(this.viewport);
    await next.enter?.();
    await gsap.to(next, { alpha: 1, duration: fade });
  }
}

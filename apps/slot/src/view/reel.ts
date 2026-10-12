import { gsap } from 'gsap';
import { Container, Sprite, type Texture } from 'pixi.js';
import type { SymbolId } from '../logic/config';

/** Symbols per second at full speed. */
export const SPIN_SPEED = 22;
/** Overshoot of the back-ease landing. */
const LANDING_OVERSHOOT = 1.3;
/** Whole symbols the reel still travels after a stop is requested. */
const LANDING_DISTANCE = 3;

const mod = (n: number, m: number) => ((n % m) + m) % m;

export interface ReelOptions {
  strip: readonly SymbolId[];
  textures: Record<SymbolId, Texture>;
  cellWidth: number;
  cellHeight: number;
  rows: number;
  /** Strip index shown in the top row at start. */
  stop?: number;
}

/**
 * One reel: rows + 1 sprites recycled as the strip scrolls. `scroll` is the strip index shown
 * in the top row; it decreases while spinning, so symbols travel downwards.
 */
export class Reel extends Container {
  private readonly strip: readonly SymbolId[];
  private readonly textures: Record<SymbolId, Texture>;
  private readonly cellHeight: number;
  private readonly sprites: Sprite[];
  private _scroll = 0;
  /** Symbols per second, driven by GSAP while starting and by update() while spinning. */
  private speed = 0;
  /** While landing, indices below `splice.from` show the result instead of the strip. */
  private splice: { from: number; landing: number; stop: number } | null = null;
  private landingTween: gsap.core.Tween | null = null;

  constructor({ strip, textures, cellWidth, cellHeight, rows, stop = 0 }: ReelOptions) {
    super();
    this.strip = strip;
    this.textures = textures;
    this.cellHeight = cellHeight;
    this.sprites = Array.from({ length: rows + 1 }, () => {
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      sprite.x = cellWidth / 2;
      return this.addChild(sprite);
    });
    this.scroll = stop;
  }

  get scroll(): number {
    return this._scroll;
  }

  set scroll(value: number) {
    this._scroll = value;
    this.render();
  }

  /** Sprite in a visible row once the reel has stopped (for win highlights). */
  symbolAt(row: number): Sprite {
    return this.sprites[row]!;
  }

  start(delay = 0): void {
    gsap.killTweensOf(this);
    this.splice = null;
    this.scroll = mod(Math.round(this._scroll), this.strip.length);
    gsap
      .timeline({ delay })
      // Small wind-up against the spin direction, then accelerate.
      .to(this, { scroll: this._scroll + 0.3, duration: 0.14, ease: 'power2.out' })
      .to(this, { speed: SPIN_SPEED, duration: 0.3, ease: 'power1.in' });
  }

  update(deltaSeconds: number): void {
    if (this.speed > 0)
      this.scroll = mod(this._scroll - this.speed * deltaSeconds, this.strip.length);
  }

  /** Lands with `stop` in the top row. `quick` is for slam-stop. Resolves when settled. */
  stop(stop: number, quick = false): Promise<void> {
    gsap.killTweensOf(this);
    this.speed = 0;

    // Everything above the window is off screen, so it can be re-mapped to show the result
    // ("splicing" the outcome into the strip) without any visible jump.
    const from = Math.floor(this._scroll);
    const landing = from - LANDING_DISTANCE;
    this.splice = { from, landing, stop };

    // Match the back-ease's starting velocity (overshoot + 3) to the spin speed so the reel
    // decelerates without a visible change in speed.
    const distance = this._scroll - landing;
    const duration = ((LANDING_OVERSHOOT + 3) * distance) / SPIN_SPEED;

    return new Promise((resolve) => {
      this.landingTween = gsap.to(this, {
        scroll: landing,
        duration: quick ? Math.min(duration, 0.28) : duration,
        ease: `back.out(${LANDING_OVERSHOOT})`,
        onComplete: () => {
          this.splice = null;
          this.landingTween = null;
          this.scroll = stop;
          resolve();
        },
      });
    });
  }

  /** Speeds up a landing that is already under way (slam-stop). */
  hurry(): void {
    this.landingTween?.timeScale(3);
  }

  private symbolFor(index: number): SymbolId {
    const { splice, strip } = this;
    if (splice && index < splice.from) {
      return strip[mod(index - splice.landing + splice.stop, strip.length)]!;
    }
    return strip[mod(index, strip.length)]!;
  }

  private render() {
    const top = Math.floor(this._scroll);
    const frac = this._scroll - top;
    // A little vertical stretch reads as motion blur at speed, without a blur filter pass.
    const stretch = 1 + (this.speed / SPIN_SPEED) * 0.12;
    this.sprites.forEach((sprite, k) => {
      sprite.texture = this.textures[this.symbolFor(top + k)];
      sprite.y = (k - frac + 0.5) * this.cellHeight;
      sprite.scale.set(1, stretch);
    });
  }
}

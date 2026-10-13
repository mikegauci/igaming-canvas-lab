import { type Bounds, colors, Confetti, fontFamily, formatCredits } from '@lab/core';
import { gsap } from 'gsap';
import { BitmapText, Container, Graphics, Text, type Texture } from 'pixi.js';
import type { CountUpStep, TierName } from '../logic/tiers';

const TIER_STYLE: Record<TierName, { color: number; coinsPerSecond: number; burst: number }> = {
  BIG: { color: colors.gold, coinsPerSecond: 18, burst: 60 },
  MEGA: { color: colors.cyan, coinsPerSecond: 36, burst: 110 },
  EPIC: { color: colors.neon, coinsPerSecond: 60, burst: 170 },
};
const RAYS = 16;
/** How long the final number stays up before the overlay fades (tap or Space skips). */
const HOLD_SECONDS = 1.6;

/**
 * The BIG / MEGA / EPIC WIN celebration: dimmed screen, spinning rays, a banner that upgrades as
 * the counter passes each tier, and a rain of spinning coins (pooled particles, one draw call).
 * Driven by the steps from planCountUp(); every step is one GSAP tween in a single timeline.
 */
export class BigWinOverlay extends Container {
  /** Fires as the banner reaches each tier (for screen shake and sounds). */
  onTier?: (tier: TierName) => void;

  private readonly dim = new Graphics();
  private readonly rays = new Graphics();
  private readonly banner: Text;
  private readonly counter: BitmapText;
  private readonly coins: Confetti;
  private timeline: gsap.core.Timeline | null = null;
  private tier: TierName | null = null;
  /** Shows the end state directly (seeking skips the timeline's callbacks). */
  private showFinal: (() => void) | null = null;
  private rainCarry = 0;
  private viewHeight = 0;
  /** The whole window in design coordinates, so the dim and coin rain reach the letterbox bars. */
  private screen: Bounds = { x: 0, y: 0, width: 0, height: 0 };

  constructor(coinTexture: Texture) {
    super();
    this.banner = new Text({
      text: '',
      style: {
        fontFamily,
        fontSize: 110,
        fontWeight: '900',
        fill: 0xffffff,
        letterSpacing: 6,
        stroke: { color: colors.bg, width: 10, join: 'round' },
        dropShadow: { color: colors.neon, blur: 18, distance: 0, alpha: 0.9 },
      },
    });
    this.banner.anchor.set(0.5);
    this.counter = new BitmapText({
      text: '',
      style: { fontFamily, fontSize: 84, fontWeight: 'bold', fill: 0xffffff },
    });
    this.counter.anchor.set(0.5);
    this.coins = new Confetti(360, coinTexture);
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * Math.PI * 2;
      const b = a + Math.PI / RAYS;
      this.rays.poly([
        0,
        0,
        Math.cos(a) * 900,
        Math.sin(a) * 900,
        Math.cos(b) * 900,
        Math.sin(b) * 900,
      ]);
    }
    this.rays.fill({ color: 0xffffff, alpha: 0.06 });
    this.addChild(this.dim, this.rays, this.coins, this.banner, this.counter);
    this.visible = false;
    this.eventMode = 'none';
    this.on('pointertap', () => this.skip());
  }

  get playing(): boolean {
    return this.timeline !== null;
  }

  resize(width: number, height: number, screen: Bounds): void {
    this.viewHeight = height;
    this.screen = screen;
    this.dim
      .clear()
      .rect(screen.x, screen.y, screen.width, screen.height)
      .fill({ color: colors.bg, alpha: 0.82 });
    this.rays.position.set(width / 2, height * 0.42);
    this.banner.position.set(width / 2, height * 0.38);
    this.counter.position.set(width / 2, height * 0.38 + 120);
  }

  /** Runs the whole celebration; resolves when it has faded out. */
  play(steps: readonly CountUpStep[]): Promise<void> {
    this.visible = true;
    this.eventMode = 'static';
    this.alpha = 0;
    // Clear the last celebration so it never flashes up while this one fades in.
    this.tier = null;
    this.banner.text = '';
    this.counter.tint = 0xffffff;
    const value = { amount: 0 };
    const render = () => (this.counter.text = formatCredits(Math.round(value.amount)));
    render();
    const finalStep = steps.at(-1);
    const finalTier = [...steps].reverse().find((s) => s.tier)?.tier ?? null;
    this.showFinal = () => {
      value.amount = finalStep?.to ?? 0;
      render();
      if (finalTier && this.tier !== finalTier) this.setTier(finalTier);
    };

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.timeline = null;
          this.showFinal = null;
          this.banner.text = '';
          this.visible = false;
          this.eventMode = 'none';
          this.coins.reset();
          resolve();
        },
      });
      this.timeline = tl;
      tl.to(this, { alpha: 1, duration: 0.25 });
      steps.forEach((step, i) => {
        const last = i === steps.length - 1;
        tl.call(() => step.tier && this.setTier(step.tier));
        tl.fromTo(
          value,
          { amount: step.from },
          {
            amount: step.to,
            duration: step.duration,
            ease: last ? 'power2.out' : 'none',
            onUpdate: render,
          },
        );
      });
      tl.addLabel('hold').to(this, { alpha: 0, duration: 0.35 }, `+=${HOLD_SECONDS}`);
    });
  }

  /** Jumps to the final number and tier, then fades out shortly after. */
  skip(): void {
    const tl = this.timeline;
    if (!tl) return;
    const hold = tl.labels.hold ?? 0;
    if (tl.time() < hold) {
      tl.seek(hold);
      this.showFinal?.();
    } else tl.timeScale(4);
  }

  update(deltaSeconds: number): void {
    this.coins.tick(deltaSeconds);
    if (!this.visible || !this.tier) return;
    this.rays.rotation += deltaSeconds * 0.25;
    // Steady coin rain from the top edge, heavier at higher tiers.
    this.rainCarry += TIER_STYLE[this.tier].coinsPerSecond * deltaSeconds;
    while (this.rainCarry >= 1) {
      this.rainCarry -= 1;
      this.coins.burst({
        ...this.coinStyle(),
        x: this.screen.x + Math.random() * this.screen.width,
        y: this.screen.y - 30,
        count: 1,
        angle: Math.PI / 2,
        spread: 0.3,
        speed: [120, 320],
      });
    }
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    this.timeline?.kill();
    gsap.killTweensOf([this, this.banner.scale]);
    super.destroy(...args);
  }

  private setTier(tier: TierName) {
    this.tier = tier;
    const { color, burst } = TIER_STYLE[tier];
    this.banner.text = `${tier} WIN`;
    this.banner.style.fill = color;
    this.counter.tint = color;
    gsap.fromTo(
      this.banner.scale,
      { x: 1.6, y: 1.6 },
      { x: 1, y: 1, duration: 0.45, ease: 'back.out(2.5)' },
    );
    this.coins.burst({
      ...this.coinStyle(),
      x: this.screen.x + this.screen.width / 2,
      y: this.viewHeight * 0.45,
      count: burst,
      angle: -Math.PI / 2,
      spread: Math.PI * 1.1,
      speed: [400, 1100],
    });
    this.onTier?.(tier);
  }

  private coinStyle() {
    return {
      size: 34,
      aspect: 1,
      spin: 0,
      flip: 'x' as const,
      gravity: 900,
      life: 3,
      palette: [0xffffff],
    };
  }
}

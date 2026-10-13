import { arcadeFont, chromeFill, colors, metalFill } from '@lab/core';
import { gsap } from 'gsap';
import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type Renderer,
  type Texture,
  type Ticker,
} from 'pixi.js';
import { createWheelEase, type WheelEase } from '../logic/ease';
import {
  pegsPassed,
  segmentAtRotation,
  segmentCenter,
  segmentWidth,
  targetRotation,
} from '../logic/geometry';
import { SEGMENTS } from '../logic/prizes';
import { pointerRotation } from '../logic/pointer';

export const RADIUS = 270;
const RIM = 22;
const BULBS = 24;
/** Radians per second at full speed. */
const SPIN_SPEED = 9;
/** Minimum travel once the result is known; sets the landing to roughly 4–6 seconds. */
const MIN_LANDING_TRAVEL = 10;
/** Minimum travel after STOP: a short, firm stop instead of the long crawl. */
const HURRIED_TRAVEL = 1.5;
/** Seconds to accelerate from rest to the free-spin speed. */
const SPIN_UP_SECONDS = 0.5;
const COUNT = SEGMENTS.length;

/** Dark enamel segments with neon edges; jackpot and ×10 retain their bright faces. */
export const SEGMENT_STYLE: Record<
  number,
  { fill: number; text: number; edge: number; label?: string }
> = {
  0: { fill: 0x141526, text: 0xb3b1ce, edge: 0x5c5b80, label: 'MISS' },
  1: { fill: 0x23274e, text: 0xc7e2ff, edge: 0x8198ee },
  2: { fill: 0x432066, text: 0xe9cbff, edge: 0xb66dff },
  3: { fill: 0x7b2059, text: 0xffd8ed, edge: colors.neon },
  5: { fill: 0x8b3b28, text: 0xffe2cb, edge: 0xff9557 },
  10: { fill: 0x47d9ef, text: 0x11152e, edge: 0xc7fbff },
  50: { fill: colors.gold, text: 0x39200d, edge: 0xfff1b0 },
};

export const segmentLabel = (multiplier: number): string =>
  SEGMENT_STYLE[multiplier]?.label ?? `×${multiplier}`;

type LightMode = 'idle' | 'spin' | 'win';

/** Seconds between bulb pattern steps. */
const LIGHT_INTERVALS: Record<LightMode, number> = { idle: 0.5, spin: 0.06, win: 0.14 };

/** Pixi's arc() measures from +x; the wheel measures clockwise from the top. */
const fromTop = (angle: number) => angle - Math.PI / 2;

function drawWheelFace(): Container {
  const face = new Container();
  const g = new Graphics();
  const w = segmentWidth(COUNT);

  SEGMENTS.forEach((segment, i) => {
    const style = SEGMENT_STYLE[segment.multiplier]!;
    g.moveTo(0, 0)
      .arc(0, 0, RADIUS, fromTop(i * w), fromTop((i + 1) * w))
      .closePath()
      .fill(style.fill);

    // Inset enamel ring: the metallic spokes remain visible between the prize windows.
    g.moveTo(Math.sin(i * w + 0.025) * 105, -Math.cos(i * w + 0.025) * 105)
      .arc(0, 0, RADIUS - 25, fromTop(i * w + 0.025), fromTop((i + 1) * w - 0.025))
      .arc(0, 0, 105, fromTop((i + 1) * w - 0.025), fromTop(i * w + 0.025), true)
      .closePath()
      .stroke({ color: style.edge, width: 2, alpha: 0.7 });

    const center = (i + 0.5) * w;
    const label = new Text({
      text: segmentLabel(segment.multiplier),
      style: {
        fontFamily: arcadeFont,
        fontSize: segment.multiplier === 0 ? 21 : 30,
        fontWeight: '900',
        fill: style.text,
        letterSpacing: 1,
        dropShadow: { color: 0x070813, blur: 3, distance: 2, alpha: 0.45 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(Math.sin(center) * RADIUS * 0.7, -Math.cos(center) * RADIUS * 0.7);
    label.rotation = center;
    face.addChild(label);
  });

  // Separators and pegs on every segment edge.
  for (let i = 0; i < COUNT; i++) {
    const a = i * w;
    g.moveTo(0, 0)
      .lineTo(Math.sin(a) * RADIUS, -Math.cos(a) * RADIUS)
      .stroke({ color: 0xadb8d2, width: 3, alpha: 0.75 });
    g.circle(Math.sin(a) * (RADIUS - 10), -Math.cos(a) * (RADIUS - 10), 7)
      .fill(0xe8f3ff)
      .stroke({ color: 0x58627f, width: 2 });
  }
  g.circle(0, 0, RADIUS).stroke({ color: 0xc6cce0, width: 6 });
  g.circle(0, 0, RADIUS * 0.3).fill({ color: 0x000000, alpha: 0.25 });

  face.addChildAt(g, 0);
  return face;
}

/**
 * The prize wheel: a rotor (one baked sprite plus a win highlight), a static rim with bulbs,
 * a hub and a flexible pointer that flicks as pegs pass it.
 */
export class PrizeWheel extends Container {
  /** Called for each peg that passes the pointer (e.g. for a tick sound). */
  onPeg?: () => void;

  private readonly rotor = new Container();
  private readonly highlight = new Graphics();
  private readonly pointer = new Graphics();
  private readonly bulbs: Sprite[];
  private readonly faceTexture: Texture;
  private readonly bulbTexture: Texture;
  /** Free-spin speed (rad/s); all rotor and pointer motion uses the Pixi frame clock. */
  private speed = 0;
  private lastRotation = 0;
  private spinUp: Promise<void> = Promise.resolve();
  private spinUpElapsed = 0;
  private settleSpinUp: (() => void) | null = null;
  private plan: {
    from: number;
    to: number;
    travel: number;
    duration: number;
    elapsed: number;
    ease: WheelEase;
  } | null = null;
  private target: { segment: number; offset: number } | null = null;
  private settleLanding: (() => void) | null = null;
  private hurried = false;
  private lightMode: LightMode = 'idle';
  private lightClock = 0;
  private lightStep = 0;

  constructor(renderer: Renderer) {
    super();

    // The face never changes, so bake it: rotating one sprite is far cheaper than redrawing
    // twelve wedges and labels every frame.
    const pad = 4;
    const face = new Container({ children: [drawWheelFace()] });
    this.faceTexture = renderer.generateTexture({
      target: face,
      frame: new Rectangle(-RADIUS - pad, -RADIUS - pad, (RADIUS + pad) * 2, (RADIUS + pad) * 2),
      // Match the screen: no point baking 2x detail for a 1x display.
      resolution: renderer.resolution,
      antialias: true,
    });
    face.destroy({ children: true });
    const faceSprite = new Sprite(this.faceTexture);
    faceSprite.anchor.set(0.5);
    this.highlight.blendMode = 'add';
    this.rotor.addChild(faceSprite, this.highlight);

    const rim = new Graphics()
      .circle(0, 3, RADIUS + RIM + 8)
      .fill(0x050611)
      .circle(0, 0, RADIUS + RIM + 4)
      .fill(metalFill())
      .stroke({ color: 0xabb7d4, width: 2 })
      .circle(0, 0, RADIUS + RIM - 3)
      .fill(0x101126)
      .stroke({ color: colors.neon, width: 3, alpha: 0.9 });
    const glow = new Graphics()
      .circle(0, 0, RADIUS + RIM + 10)
      .stroke({ color: colors.neon, width: 14, alpha: 0.15 });

    this.bulbTexture = this.bakeBulb(renderer);
    this.bulbs = Array.from({ length: BULBS }, (_, i) => {
      const a = (i / BULBS) * Math.PI * 2;
      const bulb = new Sprite(this.bulbTexture);
      bulb.anchor.set(0.5);
      bulb.position.set(Math.sin(a) * (RADIUS + RIM / 2), -Math.cos(a) * (RADIUS + RIM / 2));
      return bulb;
    });

    const hub = new Graphics()
      .circle(0, 4, 77)
      .fill({ color: 0x030412, alpha: 0.65 })
      .circle(0, 0, 75)
      .fill(metalFill())
      .stroke({ color: 0xd1dbef, width: 2 })
      .circle(0, 0, 65)
      .fill(0x171126)
      .stroke({ color: colors.neon, width: 2 })
      .circle(0, 0, 60)
      .stroke({ color: colors.neon, width: 8, alpha: 0.13 })
      .star(0, -8, 5, 37, 16)
      .fill(chromeFill())
      .stroke({ color: colors.gold, width: 1.5 });
    const hubLabel = new Text({
      text: 'LUCKY',
      style: {
        fontFamily: arcadeFont,
        fontSize: 11,
        fontWeight: '700',
        fill: 0xe7f5ff,
        letterSpacing: 2,
      },
    });
    hubLabel.anchor.set(0.5);
    hubLabel.position.set(0, 42);

    // Pointer hangs from a hinge above the wheel, tip pointing down into the pegs.
    this.pointer
      .poly([-22, 0, 22, 0, 0, 56])
      .fill(chromeFill())
      .stroke({ color: colors.neon, width: 3, join: 'round' })
      .circle(0, 0, 10)
      .fill(metalFill())
      .stroke({ color: 0xe7f5ff, width: 2 });
    this.pointer.position.set(0, -RADIUS - RIM - 4);

    this.addChild(glow, rim, ...this.bulbs, this.rotor, hub, hubLabel, this.pointer);
    // Rest with the pointer in the middle of a prize, not on a peg.
    this.rotor.rotation = -segmentCenter(0, COUNT);
    this.lastRotation = this.rotor.rotation;
    this.renderLights();
  }

  update(ticker: Ticker): void {
    const seconds = ticker.deltaMS / 1000;
    if (this.plan) {
      const plan = this.plan;
      plan.elapsed = Math.min(plan.duration, plan.elapsed + seconds);
      this.rotor.rotation = plan.from + plan.travel * plan.ease(plan.elapsed / plan.duration);
      if (plan.elapsed === plan.duration) this.finishLanding();
    } else if (this.settleSpinUp || this.speed > 0) {
      const before = this.spinUpElapsed;
      this.spinUpElapsed = Math.min(SPIN_UP_SECONDS, before + seconds);
      // Integrate the linear acceleration exactly, even when a frame straddles full speed.
      const rampTravel =
        (SPIN_SPEED * (this.spinUpElapsed ** 2 - before ** 2)) / (2 * SPIN_UP_SECONDS);
      const cruiseSeconds = seconds - (this.spinUpElapsed - before);
      this.rotor.rotation += rampTravel + SPIN_SPEED * cruiseSeconds;
      this.speed = (SPIN_SPEED * this.spinUpElapsed) / SPIN_UP_SECONDS;
      if (this.spinUpElapsed === SPIN_UP_SECONDS) {
        const settle = this.settleSpinUp;
        this.settleSpinUp = null;
        settle?.();
      }
    }

    const now = this.rotor.rotation;
    this.pointer.rotation = pointerRotation(
      this.lastRotation,
      now,
      COUNT,
      this.pointer.rotation,
      seconds,
    );
    if (pegsPassed(this.lastRotation, now, COUNT) > 0) this.onPeg?.();
    this.lastRotation = now;

    this.lightClock += seconds;
    if (this.lightClock >= LIGHT_INTERVALS[this.lightMode]) {
      this.lightClock = 0;
      this.lightStep++;
      this.renderLights();
    }
  }

  /** Accelerate forwards, then keep turning until the server result is known. */
  startSpin(): void {
    this.finishLanding();
    this.clearWin();
    this.hurried = false;
    this.lightMode = 'spin';
    this.speed = 0;
    this.spinUpElapsed = 0;
    this.spinUp = new Promise((resolve) => {
      this.settleSpinUp = resolve;
    });
  }

  /** Decelerates onto `segment`, `offset` widths from its centre. Resolves when settled. */
  async land(segment: number, offset: number): Promise<void> {
    await this.spinUp;
    this.target = { segment, offset };
    await new Promise<void>((resolve) => {
      this.settleLanding = resolve;
      if (this.hurried) this.planLanding(HURRIED_TRAVEL, 2);
      else this.planLanding(MIN_LANDING_TRAVEL, 3);
    });
  }

  /**
   * Player pressed STOP. Re-plans the landing as a short, firm stop from the wheel's current
   * speed (power 2 = constant braking). Never speeds up a wheel that is already landing.
   */
  hurry(): void {
    if (this.hurried) return;
    this.hurried = true;
    if (!this.plan) return; // not landing yet: land() will plan a short stop
    // Already in the final crawl: nothing to gain.
    if (this.plan!.to - this.rotor.rotation < HURRIED_TRAVEL + segmentWidth(COUNT)) return;
    this.planLanding(HURRIED_TRAVEL, 2);
  }

  /**
   * Starts (or restarts) the landing from the current rotation onto the target, at least
   * `minTravel` away. The duration is chosen so the ease's starting speed equals the wheel's
   * measured speed: no visible jolt.
   */
  private planLanding(minTravel: number, power: number) {
    const { segment, offset } = this.target!;
    // Carry the current speed into either the normal landing or the shorter STOP plan.
    const speed = this.plan ? this.landingSpeed() : this.speed;
    this.speed = 0;
    const from = this.rotor.rotation;
    const to = targetRotation(from, segment, offset, COUNT, minTravel);
    const travel = to - from;
    const ease = createWheelEase({ power });
    const duration = (travel * ease.initialSlope) / speed;
    this.plan = { from, to, travel, duration, elapsed: 0, ease };
  }

  private finishLanding(): void {
    this.plan = null;
    this.speed = 0;
    this.lightMode = 'idle';
    const settle = this.settleLanding;
    this.settleLanding = null;
    settle?.();
  }

  private landingSpeed(): number {
    const { travel, duration, elapsed, ease } = this.plan!;
    return (travel * ease.slope(elapsed / duration)) / duration;
  }

  /** Segment currently under the pointer. */
  get segmentUnderPointer(): number {
    return segmentAtRotation(this.rotor.rotation, COUNT);
  }

  showWin(segment: number): void {
    const w = segmentWidth(COUNT);
    this.highlight
      .clear()
      .moveTo(0, 0)
      .arc(0, 0, RADIUS, fromTop(segment * w), fromTop((segment + 1) * w))
      .closePath()
      .fill({ color: 0xffffff, alpha: 0.45 });
    this.highlight.alpha = 0;
    gsap.to(this.highlight, {
      alpha: 1,
      duration: 0.3,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
    this.lightMode = 'win';
  }

  clearWin(): void {
    gsap.killTweensOf(this.highlight);
    this.highlight.clear();
    this.lightMode = 'idle';
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    this.finishLanding();
    this.settleSpinUp?.();
    this.settleSpinUp = null;
    gsap.killTweensOf(this.highlight);
    super.destroy(...args);
    // Baked textures are owned here; display-object destroy doesn't free them.
    this.faceTexture.destroy(true);
    this.bulbTexture.destroy(true);
  }

  private renderLights() {
    this.bulbs.forEach((bulb, i) => {
      const on =
        this.lightMode === 'spin'
          ? (i + this.lightStep) % 4 === 0
          : this.lightMode === 'win'
            ? this.lightStep % 2 === 0
            : (i + this.lightStep) % 2 === 0;
      bulb.tint = on
        ? this.lightMode === 'win'
          ? colors.gold
          : i % 2
            ? 0xff8bd0
            : 0xa1f8ff
        : 0x43405e;
      bulb.alpha = on ? 1 : 0.6;
    });
  }

  private bakeBulb(renderer: Renderer): Texture {
    const bulb = new Container({
      children: [
        new Graphics()
          .circle(0, 0, 12)
          .fill({ color: 0xffffff, alpha: 0.08 })
          .circle(0, 0, 10)
          .fill({ color: 0xffffff, alpha: 0.15 })
          .circle(0, 0, 8)
          .fill(0xffffff)
          .circle(-2.5, -2.5, 3)
          .fill({ color: 0xffffff, alpha: 0.9 }),
      ],
    });
    const texture = renderer.generateTexture({
      target: bulb,
      frame: new Rectangle(-13, -13, 26, 26),
      resolution: renderer.resolution,
      antialias: true,
    });
    bulb.destroy({ children: true });
    return texture;
  }
}

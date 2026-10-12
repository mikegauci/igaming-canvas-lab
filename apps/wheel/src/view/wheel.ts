import { colors, fontFamily } from '@lab/core';
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
import { createWheelEase } from '../logic/ease';
import { pegsPassed, segmentAtRotation, segmentWidth, targetRotation } from '../logic/geometry';
import { SEGMENTS } from '../logic/prizes';

export const RADIUS = 270;
const RIM = 22;
const BULBS = 24;
/** Radians per second at full speed. */
const SPIN_SPEED = 9;
/** Minimum travel once the result is known; sets the landing to roughly 4–6 seconds. */
const MIN_LANDING_TRAVEL = 10;
/** How far the wheel creeps past its target before settling back, in segment widths. */
const OVERSHOOT_SEGMENTS = 0.25;
const COUNT = SEGMENTS.length;

/** Segment colours by multiplier; text is dark on the two light ones. */
export const SEGMENT_STYLE: Record<number, { fill: number; text: number; label?: string }> = {
  0: { fill: 0x232342, text: colors.muted, label: 'MISS' },
  1: { fill: 0x3a3a8c, text: colors.text },
  2: { fill: 0x7b2ff7, text: colors.text },
  3: { fill: colors.neon, text: colors.text },
  5: { fill: 0xff7a1a, text: colors.text },
  10: { fill: colors.cyan, text: colors.bg },
  50: { fill: colors.gold, text: colors.bg },
};

export const segmentLabel = (multiplier: number): string =>
  SEGMENT_STYLE[multiplier]?.label ?? `×${multiplier}`;

type LightMode = 'idle' | 'spin' | 'win';

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

    const center = (i + 0.5) * w;
    const label = new Text({
      text: segmentLabel(segment.multiplier),
      style: {
        fontFamily,
        fontSize: segment.multiplier === 0 ? 24 : 34,
        fontWeight: '900',
        fill: style.text,
        letterSpacing: 1,
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
      .stroke({ color: colors.gold, width: 3, alpha: 0.85 });
    g.circle(Math.sin(a) * (RADIUS - 10), -Math.cos(a) * (RADIUS - 10), 7)
      .fill(colors.gold)
      .stroke({ color: 0x8a6a12, width: 2 });
  }
  g.circle(0, 0, RADIUS).stroke({ color: colors.gold, width: 6 });
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
  private speed = 0;
  private lastRotation = 0;
  private spinUp: Promise<void> = Promise.resolve();
  private landing: gsap.core.Tween | null = null;
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
    const faceTexture = renderer.generateTexture({
      target: face,
      frame: new Rectangle(-RADIUS - pad, -RADIUS - pad, (RADIUS + pad) * 2, (RADIUS + pad) * 2),
      resolution: 2,
      antialias: true,
    });
    face.destroy({ children: true });
    const faceSprite = new Sprite(faceTexture);
    faceSprite.anchor.set(0.5);
    this.highlight.blendMode = 'add';
    this.rotor.addChild(faceSprite, this.highlight);

    const rim = new Graphics()
      .circle(0, 0, RADIUS + RIM)
      .fill(colors.panel)
      .stroke({ color: colors.neon, width: 4, alpha: 0.9 });
    const glow = new Graphics()
      .circle(0, 0, RADIUS + RIM + 10)
      .stroke({ color: colors.neon, width: 14, alpha: 0.15 });

    const bulbTexture = this.bakeBulb(renderer);
    this.bulbs = Array.from({ length: BULBS }, (_, i) => {
      const a = (i / BULBS) * Math.PI * 2;
      const bulb = new Sprite(bulbTexture);
      bulb.anchor.set(0.5);
      bulb.position.set(Math.sin(a) * (RADIUS + RIM / 2), -Math.cos(a) * (RADIUS + RIM / 2));
      return bulb;
    });

    const hub = new Graphics()
      .circle(0, 0, 46)
      .fill(colors.panel)
      .stroke({ color: colors.gold, width: 5 })
      .star(0, 0, 5, 26, 11)
      .fill(colors.gold);

    // Pointer hangs from a hinge above the wheel, tip pointing down into the pegs.
    this.pointer
      .poly([-22, 0, 22, 0, 0, 56])
      .fill(colors.text)
      .stroke({ color: colors.neon, width: 4, join: 'round' })
      .circle(0, 0, 10)
      .fill(colors.neon);
    this.pointer.position.set(0, -RADIUS - RIM - 4);

    this.addChild(glow, rim, ...this.bulbs, this.rotor, hub, this.pointer);
    this.renderLights();
  }

  update(ticker: Ticker): void {
    const seconds = ticker.deltaMS / 1000;
    if (this.speed > 0) this.rotor.rotation += this.speed * seconds;

    const now = this.rotor.rotation;
    const forward = pegsPassed(this.lastRotation, now, COUNT);
    const backward = pegsPassed(now, this.lastRotation, COUNT);
    if (forward > 0) this.flickPointer(-1);
    else if (backward > 0) this.flickPointer(1);
    this.lastRotation = now;

    this.lightClock += seconds;
    const interval = { idle: 0.5, spin: 0.06, win: 0.14 }[this.lightMode];
    if (this.lightClock >= interval) {
      this.lightClock = 0;
      this.lightStep++;
      this.renderLights();
    }
  }

  /** Small wind-back, then accelerate to full speed and keep turning until `land()`. */
  startSpin(): void {
    this.clearWin();
    this.hurried = false;
    this.lightMode = 'spin';
    gsap.killTweensOf(this.rotor);
    this.spinUp = new Promise((resolve) => {
      gsap
        .timeline({ onComplete: resolve, onInterrupt: resolve })
        .to(this.rotor, {
          rotation: this.rotor.rotation - 0.12,
          duration: 0.18,
          ease: 'power2.out',
        })
        .to(this, { speed: SPIN_SPEED, duration: 0.5, ease: 'power1.in' });
    });
  }

  /** Decelerates onto `segment`, `offset` widths from its centre. Resolves when settled. */
  async land(segment: number, offset: number): Promise<void> {
    if (!this.hurried) await this.spinUp;
    gsap.killTweensOf([this, this.rotor]);
    const speed = Math.max(this.speed, SPIN_SPEED * 0.5);
    this.speed = 0;

    const from = this.rotor.rotation;
    const to = targetRotation(from, segment, offset, COUNT, MIN_LANDING_TRAVEL);
    const travel = to - from;
    const ease = createWheelEase({
      overshoot: (OVERSHOOT_SEGMENTS * segmentWidth(COUNT)) / travel,
    });
    // Match the ease's starting speed to the wheel's current speed: no visible jolt.
    const duration = (travel * ease.initialSlope) / speed;

    await new Promise<void>((resolve) => {
      const settle = () => {
        this.landing = null;
        this.lightMode = 'idle';
        resolve();
      };
      this.landing = gsap.to(this.rotor, {
        rotation: to,
        duration,
        ease,
        onComplete: settle,
        onInterrupt: settle,
      });
      if (this.hurried) this.landing.timeScale(4);
    });
  }

  /** Player pressed STOP: land much faster (now, or as soon as the result arrives). */
  hurry(): void {
    this.hurried = true;
    this.landing?.timeScale(4);
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
    gsap.killTweensOf([this, this.rotor, this.highlight, this.pointer]);
    super.destroy(...args);
  }

  private flickPointer(direction: 1 | -1) {
    this.onPeg?.();
    gsap.fromTo(
      this.pointer,
      { rotation: 0.38 * direction },
      { rotation: 0, duration: 0.3, ease: 'elastic.out(1.1, 0.35)', overwrite: true },
    );
  }

  private renderLights() {
    this.bulbs.forEach((bulb, i) => {
      const on =
        this.lightMode === 'spin'
          ? (i + this.lightStep) % 4 === 0
          : this.lightMode === 'win'
            ? this.lightStep % 2 === 0
            : (i + this.lightStep) % 2 === 0;
      bulb.tint = on ? colors.gold : 0x5a4a1a;
      bulb.alpha = on ? 1 : 0.6;
    });
  }

  private bakeBulb(renderer: Renderer): Texture {
    const bulb = new Container({
      children: [
        new Graphics()
          .circle(0, 0, 8)
          .fill(0xffffff)
          .circle(-2.5, -2.5, 3)
          .fill({ color: 0xffffff, alpha: 0.9 }),
      ],
    });
    const texture = renderer.generateTexture({
      target: bulb,
      frame: new Rectangle(-9, -9, 18, 18),
      resolution: 2,
      antialias: true,
    });
    bulb.destroy({ children: true });
    return texture;
  }
}

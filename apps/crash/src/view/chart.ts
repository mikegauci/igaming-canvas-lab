import {
  arcadeFont,
  chromeFill,
  colors,
  Confetti,
  fontFamily,
  metalFill,
  verticalGradient,
} from '@lab/core';
import {
  BitmapText,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  type Renderer,
  type Texture,
} from 'pixi.js';
import { GROWTH, multiplierAt, secondsToReach, toCents } from '../logic/crash';

const PAD = { left: 64, right: 24, top: 24, bottom: 40 };
const CURVE_POINTS = 64;
const STARS = 48;
/** How quickly the axes catch up with where they should be (per second). */
const CAMERA_EASE = 4;
const Y_STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const X_STEPS = [1, 2, 5, 10, 15, 30, 60, 120];
const TICKS = 5;

/** Multiplier colour climbs from white through gold and cyan to neon as the round runs. */
export const tierColor = (multiplier: number): number =>
  multiplier >= 10
    ? colors.neon
    : multiplier >= 5
      ? colors.cyan
      : multiplier >= 2
        ? colors.gold
        : colors.text;

const CRASH_RED = 0xff3e5e;
const FIRE = [CRASH_RED, 0xff7a1a, colors.gold, 0xffffff];

function bake(renderer: Renderer, art: Container, frame: Rectangle): Texture {
  const wrapper = new Container({ children: [art] });
  const texture = renderer.generateTexture({
    target: wrapper,
    frame,
    resolution: renderer.resolution,
    antialias: true,
  });
  wrapper.destroy({ children: true });
  return texture;
}

/** Chrome rocket with red fins, like the cabinet art, pointing along +x and centred. */
function drawRocket(): Container {
  const fin = { color: 0x5a0f22, width: 1.5, join: 'round' as const };
  const g = new Graphics();
  g.poly([-20, -12, -34, -27, -10, -12]).fill(CRASH_RED).stroke(fin); // top fin
  g.poly([-20, 12, -34, 27, -10, 12]).fill(CRASH_RED).stroke(fin); // bottom fin
  g.ellipse(0, 0, 32, 14).fill(chromeFill()).stroke({ color: 0x3a4466, width: 1.5 });
  g.poly([24, -10, 41, 0, 24, 10]).fill(CRASH_RED).stroke(fin); // nose
  g.circle(6, 0, 6.5).fill(0x0d1a3a).stroke({ color: CRASH_RED, width: 2 });
  g.circle(6, 0, 4).fill(colors.cyan);
  g.circle(4.5, -1.5, 1.5).fill(0xffffff);
  return g;
}

function drawFlame(): Container {
  return new Graphics()
    .poly([0, -9, -30, 0, 0, 9])
    .fill(0xff7a1a)
    .poly([0, -5, -18, 0, 0, 5])
    .fill(colors.gold);
}

interface Marker {
  seconds: number;
  view: Container;
}

/**
 * The flight: a grid whose axes rescale as the multiplier climbs (the "camera"), the curve with a
 * glow underneath, a rocket riding its tip, drifting stars for speed, and the big multiplier.
 * It only draws; the scene feeds it the client clock and the server's events.
 */
export class CrashChart extends Container {
  private readonly bg = new Graphics();
  private readonly sunset = new Graphics();
  private readonly grid = new Graphics();
  private readonly area = new Graphics();
  private readonly curve = new Graphics();
  private readonly stars: Sprite[];
  private readonly rocket = new Container();
  private readonly flame: Sprite;
  private readonly multiplier: BitmapText;
  private readonly caption: BitmapText;
  private readonly yLabels: BitmapText[];
  private readonly xLabels: BitmapText[];
  private readonly markers: Marker[] = [];
  private readonly markerLayer = new Container();
  private readonly debris = new Confetti(160);
  private readonly textures: Texture[];
  private readonly plotMask = new Graphics();
  private chartWidth = 0;
  private chartHeight = 0;
  private elapsed = 0;
  private crashedAt: number | null = null;
  private running = false;
  /** Visible axis ranges, eased towards their targets. */
  private tMax = 8;
  private mMax = 2;
  private clock = 0;

  constructor(renderer: Renderer, width: number, height: number) {
    super();
    const rocketTexture = bake(renderer, drawRocket(), new Rectangle(-36, -28, 78, 56));
    const flameTexture = bake(renderer, drawFlame(), new Rectangle(-32, -10, 33, 20));
    const starTexture = bake(
      renderer,
      new Graphics().circle(0, 0, 2).fill(0xffffff),
      new Rectangle(-2, -2, 4, 4),
    );
    this.textures = [rocketTexture, flameTexture, starTexture];

    const body = new Sprite(rocketTexture);
    body.anchor.set(0.5);
    this.flame = new Sprite(flameTexture);
    this.flame.anchor.set(1, 0.5);
    this.flame.x = -28;
    this.rocket.addChild(this.flame, body);

    this.stars = Array.from({ length: STARS }, () => {
      const star = new Sprite(starTexture);
      star.anchor.set(0.5);
      star.alpha = 0.2 + Math.random() * 0.5;
      star.scale.set(0.5 + Math.random());
      return star;
    });

    const label = (size: number) =>
      new BitmapText({
        text: '',
        style: { fontFamily, fontSize: size, fontWeight: 'bold', fill: 0xffffff },
      });
    this.multiplier = new BitmapText({
      text: '',
      style: { fontFamily: arcadeFont, fontSize: 88, fontWeight: 'bold', fill: 0xffffff },
    });
    this.multiplier.anchor.set(0.5);
    this.caption = new BitmapText({
      text: '',
      style: { fontFamily: arcadeFont, fontSize: 20, fontWeight: 'bold', fill: 0xffffff },
    });
    this.caption.anchor.set(0.5);
    this.caption.tint = colors.muted;
    this.yLabels = Array.from({ length: TICKS + 1 }, () => {
      const l = label(14);
      l.anchor.set(1, 0.5);
      l.tint = colors.muted;
      return l;
    });
    this.xLabels = Array.from({ length: TICKS + 2 }, () => {
      const l = label(14);
      l.anchor.set(0.5, 0);
      l.tint = colors.muted;
      return l;
    });

    const plot = new Container({
      children: [
        this.sunset,
        ...this.stars,
        this.area,
        this.curve,
        this.markerLayer,
        this.rocket,
        this.debris,
      ],
    });
    plot.mask = this.plotMask;
    this.addChild(
      this.bg,
      this.grid,
      ...this.yLabels,
      ...this.xLabels,
      plot,
      this.plotMask,
      this.multiplier,
      this.caption,
    );
    this.setSize(width, height);
    this.reset();
  }

  get size(): { width: number; height: number } {
    return { width: this.chartWidth, height: this.chartHeight };
  }

  setSize(width: number, height: number): void {
    this.chartWidth = width;
    this.chartHeight = height;
    // Metal bezel around a dark neon-edged screen, like the wheel's rim.
    this.bg
      .clear()
      .roundRect(-12, -8, width + 24, height + 22, 26)
      .fill({ color: 0x050611, alpha: 0.85 })
      .roundRect(-10, -10, width + 20, height + 20, 26)
      .fill(metalFill())
      .stroke({ color: 0xabb7d4, width: 2 })
      .roundRect(0, 0, width, height, 18)
      .fill(0x0b0a1f)
      .stroke({ color: colors.neon, width: 3, alpha: 0.9 })
      .roundRect(4, 4, width - 8, height - 8, 15)
      .stroke({ color: colors.neon, width: 9, alpha: 0.13 });
    this.drawSunset();
    this.plotMask.clear().rect(PAD.left, PAD.top, this.plotWidth, this.plotHeight).fill(0xffffff);
    this.stars.forEach((star) => {
      star.position.set(
        PAD.left + Math.random() * this.plotWidth,
        PAD.top + Math.random() * this.plotHeight,
      );
    });
    this.multiplier.position.set(PAD.left + this.plotWidth / 2, PAD.top + this.plotHeight * 0.38);
    this.caption.position.set(this.multiplier.x, this.multiplier.y + 66);
    this.draw();
  }

  /** Back to the waiting state between rounds. */
  reset(): void {
    this.running = false;
    this.elapsed = 0;
    this.crashedAt = null;
    this.tMax = 8;
    this.mMax = 2;
    this.markers.splice(0).forEach((m) => m.view.destroy({ children: true }));
    this.debris.reset();
    this.rocket.visible = false;
    this.multiplier.text = '1.00×';
    this.multiplier.tint = colors.text;
    this.draw();
  }

  /** The round is live on the server: start the climb from 1.00×. */
  launch(): void {
    this.reset();
    this.running = true;
    this.rocket.visible = true;
  }

  /** Client-side seconds since launch; the scene drives this from the ticker. */
  setElapsed(seconds: number): void {
    if (!this.running || this.crashedAt !== null) return;
    this.elapsed = seconds;
  }

  setCaption(text: string, color: number = colors.muted): void {
    this.caption.text = text;
    this.caption.tint = color;
  }

  /** The server pushed the crash: freeze on the crash point and blow the rocket up. */
  crash(crashPoint: number): void {
    this.crashedAt = crashPoint;
    this.elapsed = secondsToReach(crashPoint);
    this.draw();
    const tip = this.rocket.position;
    this.rocket.visible = false;
    this.debris.burst({
      x: tip.x,
      y: tip.y,
      count: 140,
      angle: 0,
      spread: Math.PI * 2,
      speed: [150, 650],
      size: 10,
      gravity: 500,
      life: 1.4,
      palette: FIRE,
    });
  }

  /** Flag on the curve where the player cashed out. */
  markCashOut(multiplier: number): void {
    const view = new Container();
    const pole = new Graphics()
      .moveTo(0, 0)
      .lineTo(0, -34)
      .stroke({ color: colors.gold, width: 2 })
      .poly([0, -34, 26, -28, 0, -22])
      .fill(colors.gold);
    const text = new BitmapText({
      text: `${multiplier.toFixed(2)}×`,
      style: { fontFamily, fontSize: 14, fontWeight: 'bold', fill: colors.gold },
    });
    // Beside the pennant rather than on it: the label is wider than the flag.
    text.position.set(30, -36);
    view.addChild(pole, text);
    this.markerLayer.addChild(view);
    this.markers.push({ seconds: secondsToReach(multiplier), view });
    this.draw();
  }

  update(deltaSeconds: number): void {
    this.clock += deltaSeconds;
    this.debris.tick(deltaSeconds);
    if (!this.running) return;

    // Ease the camera towards keeping the tip in the lower-right part of the plot.
    const m = this.currentMultiplier();
    const targetT = Math.max(8, this.elapsed * 1.25);
    const targetM = Math.max(2, 1 + (m - 1) * 1.35);
    const k = Math.min(1, deltaSeconds * CAMERA_EASE);
    this.tMax += (targetT - this.tMax) * k;
    this.mMax += (targetM - this.mMax) * k;

    // Stars stream past faster as the multiplier climbs.
    if (this.crashedAt === null) {
      const speed = 40 + GROWTH * m * 120;
      for (const star of this.stars) {
        star.x -= speed * deltaSeconds * star.scale.x;
        star.y += speed * 0.35 * deltaSeconds * star.scale.x;
        if (star.x < PAD.left) star.x += this.plotWidth;
        if (star.y > PAD.top + this.plotHeight) star.y -= this.plotHeight;
      }
      this.flame.scale.set(0.8 + Math.sin(this.clock * 40) * 0.2 + Math.random() * 0.15, 1);
    }
    this.draw();
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    super.destroy(...args);
    this.textures.forEach((texture) => texture.destroy(true));
  }

  /** A faint striped retrowave sun setting behind the plot, drawn once per size. */
  private drawSunset() {
    const radius = Math.min(this.plotWidth, this.plotHeight) * 0.55;
    const cx = PAD.left + this.plotWidth / 2;
    const baseY = PAD.top + this.plotHeight;
    const g = this.sunset.clear();
    g.circle(cx, baseY, radius).fill(
      verticalGradient([
        [0, '#ffd23e'],
        [0.45, '#ff5fa8'],
        [1, '#7b2ff7'],
      ]),
    );
    // Gaps widen towards the horizon, like the cabinet art.
    for (let i = 0; i < 7; i++) {
      const y = baseY - radius * 0.55 + i * radius * 0.08;
      g.rect(cx - radius, y, radius * 2, 2 + i * 1.6).fill(0x0b0a1f);
    }
    g.alpha = 0.22;
  }

  private get plotWidth() {
    return this.chartWidth - PAD.left - PAD.right;
  }

  private get plotHeight() {
    return this.chartHeight - PAD.top - PAD.bottom;
  }

  private currentMultiplier(): number {
    return this.crashedAt ?? multiplierAt(this.elapsed);
  }

  private toScreen(seconds: number, multiplier: number): { x: number; y: number } {
    return {
      x: PAD.left + (seconds / this.tMax) * this.plotWidth,
      y: PAD.top + this.plotHeight - ((multiplier - 1) / (this.mMax - 1)) * this.plotHeight,
    };
  }

  private draw() {
    this.drawGrid();
    const m = this.currentMultiplier();
    const color = this.crashedAt !== null ? CRASH_RED : tierColor(m);

    this.curve.clear();
    this.area.clear();
    if (this.running && this.elapsed > 0) {
      const points: number[] = [];
      for (let i = 0; i <= CURVE_POINTS; i++) {
        const t = (this.elapsed * i) / CURVE_POINTS;
        const { x, y } = this.toScreen(t, multiplierAt(t));
        points.push(x, y);
      }
      const baseY = PAD.top + this.plotHeight;
      this.area
        .poly([PAD.left, baseY, ...points, points.at(-2)!, baseY])
        .fill({ color, alpha: 0.12 });
      this.curve.poly(points, false).stroke({ color, width: 5, cap: 'round', join: 'round' });

      const tip = this.toScreen(this.elapsed, m);
      this.rocket.position.set(tip.x, tip.y);
      // Point along the curve: its slope on screen is dm/dt = GROWTH·m, scaled to the axes.
      const dx = this.plotWidth / this.tMax;
      const dy = (-GROWTH * m * this.plotHeight) / (this.mMax - 1);
      this.rocket.rotation = Math.atan2(dy, dx);
    }

    for (const marker of this.markers) {
      const p = this.toScreen(marker.seconds, multiplierAt(marker.seconds));
      marker.view.position.set(p.x, p.y);
    }

    this.multiplier.text = `${toCents(m).toFixed(2)}×`;
    this.multiplier.tint = color;
  }

  private drawGrid() {
    const g = this.grid.clear();
    const yStep = Y_STEPS.find((s) => (this.mMax - 1) / s <= TICKS) ?? Y_STEPS.at(-1)!;
    const xStep = X_STEPS.find((s) => this.tMax / s <= TICKS + 1) ?? X_STEPS.at(-1)!;

    // 1× is the baseline; the rest sit on round multiples of the step (2×, 4×… or 10×, 20×…).
    const yValues = [1];
    for (let v = Math.floor(1 / yStep + 1) * yStep; v <= this.mMax; v += yStep) yValues.push(v);
    this.yLabels.forEach((label, i) => {
      const value = yValues[i];
      label.visible = value !== undefined;
      if (value === undefined) return;
      const { y } = this.toScreen(0, value);
      g.moveTo(PAD.left, y).lineTo(PAD.left + this.plotWidth, y);
      label.text = `${value.toFixed(yStep < 1 ? 2 : 0)}×`;
      label.position.set(PAD.left - 10, y);
    });
    this.xLabels.forEach((label, i) => {
      const value = i * xStep;
      const visible = value <= this.tMax;
      label.visible = visible;
      if (!visible) return;
      const { x } = this.toScreen(value, 1);
      g.moveTo(x, PAD.top).lineTo(x, PAD.top + this.plotHeight);
      label.text = `${value}s`;
      label.position.set(x, PAD.top + this.plotHeight + 10);
    });
    g.stroke({ color: colors.cyan, width: 1, alpha: 0.12 });
  }
}

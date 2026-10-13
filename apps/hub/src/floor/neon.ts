import { gsap } from 'gsap';
import { Container, FillGradient, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { displayFont, scriptFont } from './fonts';

/** A colour pushed toward white: the hot core of a neon tube. */
export function tubeCore(color: number, amount = 0.65): number {
  const ch = (shift: number) => {
    const c = (color >> shift) & 0xff;
    return Math.round(c + (255 - c) * amount);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * Text styled as a lit neon tube: a near-white core, an outline in the tube's colour and a glow
 * baked into the text texture (dropShadow), so it costs no filter pass.
 */
export function neonStyle(
  color: number,
  size: number,
  extra: TextStyleOptions = {},
): TextStyleOptions {
  return {
    fontFamily: displayFont,
    fontSize: size,
    fontWeight: '700',
    fill: tubeCore(color),
    stroke: { color, width: Math.max(2, size * 0.09), join: 'round' },
    dropShadow: { color, blur: size * 0.45, distance: 0, alpha: 1, angle: 0 },
    padding: size * 0.6,
    ...extra,
  };
}

/**
 * Small HUD text in a neon colour, built for legibility over a busy, glowing backdrop: a solid
 * coloured fill with a dark outline, then a softer glow. A pale tube core reads fine at title
 * size but blurs into its own glow on small text.
 */
export function hudStyle(
  color: number,
  size: number,
  extra: TextStyleOptions = {},
): TextStyleOptions {
  return {
    fontFamily: displayFont,
    fontSize: size,
    fontWeight: '700',
    fill: tubeCore(color, 0.3),
    stroke: { color: 0x12041f, width: Math.max(3, size * 0.22), join: 'round' },
    dropShadow: { color, blur: size * 0.5, distance: 0, alpha: 0.55, angle: 0 },
    padding: size * 0.6,
    ...extra,
  };
}

/** Stutter pattern for a tube striking: [time in s, alpha]. */
const STRIKE: [number, number][] = [
  [0, 0],
  [0.05, 0.9],
  [0.09, 0.1],
  [0.16, 0.7],
  [0.2, 0.05],
  [0.32, 1],
  [0.38, 0.4],
  [0.44, 1],
];

/** Adds a neon tube striking (flicker, then on) for `target` to `timeline` at `at`. */
export function strike(timeline: gsap.core.Timeline, target: Container, at: number): void {
  timeline.set(target, { alpha: 0 }, at);
  for (const [time, alpha] of STRIKE) timeline.set(target, { alpha }, at + time);
}

const GLINT_EVERY = 5.5;
const GLINT_DURATION = 0.9;

/**
 * The floor's title: "iGAMING CANVAS LAB" in 80s chrome (sky above its own horizon line, sunset
 * below it), a glint that sweeps across the letters every few seconds, and "Casino Floor" in a
 * neon script crossing its lower corner.
 */
export class NeonTitle extends Container {
  readonly chrome: Text;
  readonly script: Text;
  private readonly glint: Text;
  private readonly glintMask = new Graphics();
  /** Seconds since the last glint started; it starts idle until shine(). */
  private time = GLINT_DURATION;

  constructor() {
    super();
    const chromeFill = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: '#ffffff' },
        { offset: 0.32, color: '#b9f4ff' },
        { offset: 0.5, color: '#2a6cff' },
        { offset: 0.52, color: '#ffffff' },
        { offset: 0.66, color: '#ffc1e6' },
        { offset: 1, color: '#ff3ea5' },
      ],
    });
    this.chrome = new Text({
      text: 'iGAMING CANVAS LAB',
      style: {
        fontFamily: displayFont,
        fontSize: 48,
        fontWeight: '900',
        letterSpacing: 2,
        fill: chromeFill,
        stroke: { color: 0x14052a, width: 5, join: 'round' },
        dropShadow: { color: 0xff3ea5, blur: 18, distance: 0, alpha: 0.9, angle: 0 },
        padding: 24,
      },
    });
    this.chrome.anchor.set(0.5);

    // The glint is a white copy of the title, shown only through a moving slanted band.
    this.glint = new Text({
      text: this.chrome.text,
      style: { ...this.chrome.style, fill: 0xffffff, stroke: undefined, dropShadow: false },
    });
    this.glint.anchor.set(0.5);
    this.glint.alpha = 0.85;
    this.glint.mask = this.glintMask;

    this.script = new Text({
      text: 'Casino Floor',
      style: neonStyle(0xff3ea5, 46, {
        fontFamily: scriptFont,
        fontWeight: '400',
        letterSpacing: 1,
      }),
    });
    this.script.anchor.set(0.5);
    this.script.rotation = -0.12;

    this.addChild(this.chrome, this.glint, this.glintMask, this.script);
    this.layout(1);
  }

  /** Scales the title for the width available (it's wide; phones get a smaller one). */
  layout(scale: number): void {
    this.chrome.scale.set(scale);
    this.glint.scale.set(scale);
    this.script.scale.set(scale);
    // Under the right half, crossing the baseline without covering the letters.
    this.script.position.set(this.chrome.width * 0.27, this.chrome.height * 0.58);
  }

  /** Sweeps the glint across now; it then repeats every GLINT_EVERY seconds. */
  shine(): void {
    this.time = 0;
  }

  update(seconds: number): void {
    this.time += seconds;
    if (this.time > GLINT_EVERY) this.time = 0;
    const t = this.time / GLINT_DURATION;
    const half = this.chrome.width / 2;
    const band = 34 * this.chrome.scale.x;
    const x = -half - band * 2 + (half * 2 + band * 4) * Math.min(t, 1);
    const h = this.chrome.height / 2;
    this.glintMask.clear();
    if (t < 1) {
      this.glintMask.poly([x - band, h, x, -h, x + band, -h, x, h]).fill(0xffffff);
    }
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    gsap.killTweensOf([this, this.chrome, this.script, this.chrome.scale]);
    super.destroy(...args);
  }
}

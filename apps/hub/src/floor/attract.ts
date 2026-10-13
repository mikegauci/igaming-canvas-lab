import { colors } from '@lab/core';
import { BitmapText, Container, FillGradient, Graphics } from 'pixi.js';
import type { GameInfo } from './games';
import { displayFont } from './fonts';

/** Size of a cabinet's screen, in cabinet space. */
export const SCREEN_WIDTH = 160;
export const SCREEN_HEIGHT = 130;

/**
 * A cabinet's attract mode: a tiny looping preview of its game. Each one is a handful of Graphics
 * moved, shown or redrawn per frame, so five of them cost almost nothing.
 */
export interface Attract extends Container {
  update(seconds: number): void;
}

const RED = 0xff3e5e;
const VIOLET = 0x8a4dff;
const ORANGE = 0xff7a1a;
const CHERRY = 0xe8173a;

const vertical = (stops: [number, number][]) =>
  new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    textureSpace: 'local',
    colorStops: stops.map(([offset, color]) => ({ offset, color })),
  });

/** A five-point star with a darker rim and a highlight. */
function star(g: Graphics, x: number, y: number, r: number, color = colors.gold): Graphics {
  return g
    .star(x, y, 5, r, r * 0.45)
    .fill(color)
    .stroke({ color: 0x7a4a00, width: Math.max(1, r * 0.12), join: 'round' })
    .star(x - r * 0.12, y - r * 0.15, 5, r * 0.45, r * 0.2)
    .fill({ color: 0xffffff, alpha: 0.45 });
}

/** A cut gem: a crown over a pointed pavilion, with facet lines. */
function gem(g: Graphics, x: number, y: number, r: number, color = 0xd84dff): Graphics {
  return g
    .poly([
      x - r,
      y - r * 0.3,
      x - r * 0.55,
      y - r * 0.8,
      x + r * 0.55,
      y - r * 0.8,
      x + r,
      y - r * 0.3,
      x,
      y + r,
    ])
    .fill(color)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.7, join: 'round' })
    .poly([
      x - r * 0.55,
      y - r * 0.8,
      x - r * 0.2,
      y - r * 0.3,
      x + r * 0.2,
      y - r * 0.3,
      x + r * 0.55,
      y - r * 0.8,
    ])
    .fill({ color: 0xffffff, alpha: 0.35 })
    .moveTo(x - r, y - r * 0.3)
    .lineTo(x + r, y - r * 0.3)
    .moveTo(x - r * 0.2, y - r * 0.3)
    .lineTo(x, y + r)
    .lineTo(x + r * 0.2, y - r * 0.3)
    .stroke({ color: 0xffffff, width: 0.8, alpha: 0.5 });
}

/** Two cherries on a forked stem. */
function cherries(g: Graphics, x: number, y: number, r: number): Graphics {
  return g
    .moveTo(x - r * 0.7, y + r * 0.3)
    .quadraticCurveTo(x - r * 0.2, y - r * 0.6, x + r * 0.4, y - r * 1.1)
    .moveTo(x + r * 0.7, y + r * 0.4)
    .quadraticCurveTo(x + r * 0.5, y - r * 0.4, x + r * 0.4, y - r * 1.1)
    .stroke({ color: 0x2f9e3a, width: Math.max(1.5, r * 0.18), cap: 'round' })
    .ellipse(x + r * 0.45, y - r * 1.05, r * 0.45, r * 0.2)
    .fill(0x3fcf4c)
    .circle(x - r * 0.65, y + r * 0.55, r * 0.55)
    .fill(CHERRY)
    .circle(x + r * 0.7, y + r * 0.62, r * 0.55)
    .fill(CHERRY)
    .circle(x - r * 0.82, y + r * 0.38, r * 0.15)
    .fill({ color: 0xffffff, alpha: 0.7 })
    .circle(x + r * 0.53, y + r * 0.45, r * 0.15)
    .fill({ color: 0xffffff, alpha: 0.7 });
}

/** A four-leaf clover. */
function clover(g: Graphics, x: number, y: number, r: number): Graphics {
  const leaf = r * 0.42;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    g.circle(x + dx * leaf * 0.75, y + dy * leaf * 0.75, leaf).fill(0x3fd65a);
  }
  return g
    .moveTo(x, y)
    .quadraticCurveTo(x + r * 0.3, y + r * 0.7, x + r * 0.15, y + r)
    .stroke({ color: 0x2f9e3a, width: 2, cap: 'round' })
    .circle(x, y, leaf * 0.35)
    .fill(0x9dff9a);
}

/** A gold coin, seen face-on (squash it on x to spin it). */
function coin(g: Graphics, x: number, y: number, r: number): Graphics {
  return g
    .circle(x, y, r)
    .fill(colors.gold)
    .stroke({ color: 0xb8901a, width: Math.max(1, r * 0.22) })
    .circle(x - r * 0.3, y - r * 0.3, r * 0.25)
    .fill({ color: 0xffffff, alpha: 0.6 });
}

/** A chunky lucky seven, drawn rather than typeset so it reads at reel size. */
function seven(g: Graphics, x: number, y: number, r: number): Graphics {
  const p = (px: number, py: number) => [x + px * r, y + py * r];
  return g
    .poly([
      ...p(-0.75, -0.9),
      ...p(0.8, -0.9),
      ...p(0.8, -0.5),
      ...p(-0.05, 0.95),
      ...p(-0.6, 0.95),
      ...p(0.2, -0.45),
      ...p(-0.75, -0.45),
    ])
    .fill(
      vertical([
        [0, 0xff6b7d],
        [1, 0xc8102e],
      ]),
    )
    .stroke({ color: 0x2a0b3d, width: Math.max(1.5, r * 0.14), join: 'round' })
    .rect(x - 0.62 * r, y - 0.82 * r, 1.3 * r, 0.12 * r)
    .fill({ color: 0xffffff, alpha: 0.45 });
}

type SlotSymbol = 'seven' | 'cherry' | 'star' | 'gem';

/** The reel strip, top to bottom. A win stops each reel on strip[0], the seven. */
const STRIP: SlotSymbol[] = ['seven', 'cherry', 'star', 'gem', 'cherry', 'star'];
const REEL_WIDTH = 46;
const REEL_GAP = 5;
const ROW = 40;
const REEL_SPEED = 9;

function slotSymbol(kind: SlotSymbol): Container {
  const g = new Graphics();
  if (kind === 'seven') seven(g, 0, 0, 16);
  else if (kind === 'cherry') cherries(g, -2, -4, 11);
  else if (kind === 'star') star(g, 0, 1, 15);
  else gem(g, 0, 0, 14, 0x21d4ff);
  return g;
}

/** Three silver reels that spin, stop left to right on 7-7-7 and flash the payline. */
class SlotAttract extends Container implements Attract {
  /** Per reel, per visible row, one copy of each symbol (only the current one is shown). */
  private readonly cells: Map<SlotSymbol, Container>[][] = [];
  private readonly payline = new Graphics();
  private clock = 0;

  constructor() {
    super();
    const left = (SCREEN_WIDTH - REEL_WIDTH * 3 - REEL_GAP * 2) / 2;
    const backs = new Graphics();
    const shade = new Graphics();
    const symbols = new Container();
    for (let i = 0; i < 3; i++) {
      const x = left + i * (REEL_WIDTH + REEL_GAP);
      backs.roundRect(x, 4, REEL_WIDTH, SCREEN_HEIGHT - 8, 5).fill(
        vertical([
          [0, 0x9a93b4],
          [0.5, 0xffffff],
          [1, 0x9a93b4],
        ]),
      );
      // The drum curves away at the top and bottom.
      shade
        .rect(x, 4, REEL_WIDTH, 18)
        .fill({ color: 0x1a0b2e, alpha: 0.35 })
        .rect(x, SCREEN_HEIGHT - 22, REEL_WIDTH, 18)
        .fill({ color: 0x1a0b2e, alpha: 0.35 });
      const rows: Map<SlotSymbol, Container>[] = [];
      for (let row = 0; row < 4; row++) {
        const cell = new Map<SlotSymbol, Container>();
        for (const kind of new Set(STRIP)) {
          const symbol = slotSymbol(kind);
          symbol.x = x + REEL_WIDTH / 2;
          cell.set(kind, symbol);
          symbols.addChild(symbol);
        }
        rows.push(cell);
      }
      this.cells.push(rows);
    }
    // Dividers between the reels.
    for (let i = 1; i < 3; i++) {
      const x = left + i * (REEL_WIDTH + REEL_GAP) - REEL_GAP / 2;
      shade.rect(x - 1, 0, 2, SCREEN_HEIGHT).fill(0x05020c);
    }
    this.payline.visible = false;
    this.addChild(backs, symbols, shade, this.payline);
    this.payline
      .rect(left - 4, SCREEN_HEIGHT / 2 - 1.5, REEL_WIDTH * 3 + REEL_GAP * 2 + 8, 3)
      .fill(colors.gold)
      .roundRect(left - 2, SCREEN_HEIGHT / 2 - ROW / 2, REEL_WIDTH * 3 + REEL_GAP * 2 + 4, ROW, 4)
      .stroke({ color: colors.gold, width: 2 });
  }

  update(seconds: number): void {
    this.clock = (this.clock + seconds) % 3.4;
    this.cells.forEach((rows, i) => {
      const stopAt = 1.1 + i * 0.35;
      // Each reel starts at a phase that lands it on the seven exactly when it stops, so there
      // is no jump; then it overshoots a little and settles.
      let position: number;
      if (this.clock < stopAt) {
        position = REEL_SPEED * (this.clock - stopAt);
      } else {
        const settle = this.clock - stopAt;
        position = 0.22 * Math.sin(settle * 22) * Math.exp(-settle * 9);
      }
      const base = Math.floor(position);
      const frac = position - base;
      rows.forEach((cell, k) => {
        const row = k - 2;
        const index = (((base - row) % STRIP.length) + STRIP.length) % STRIP.length;
        const current = STRIP[index]!;
        const y = SCREEN_HEIGHT / 2 + (row + frac) * ROW;
        for (const [kind, symbol] of cell) {
          symbol.visible = kind === current;
          symbol.y = y;
        }
      });
    });
    this.payline.visible = this.clock > 2.2 && Math.floor(this.clock * 8) % 2 === 0;
  }
}

const WHEEL_COLORS = [colors.neon, colors.gold, colors.cyan, VIOLET, ORANGE, 0x7cff6b];
const WHEEL_RADIUS = 50;
const WHEEL_BULBS = 16;

/** A prize wheel ringed with chasing bulbs: spins up, coasts down, pauses, repeats. */
class WheelAttract extends Container implements Attract {
  private readonly wheel = new Graphics();
  private readonly bulbs: Graphics[] = [];
  private velocity = 9;
  private clock = 0;
  private chase = 0;

  constructor() {
    super();
    const cx = SCREEN_WIDTH / 2;
    const cy = SCREEN_HEIGHT / 2 + 4;
    // A starburst behind the wheel.
    const rays = new Graphics();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      rays
        .poly([
          cx,
          cy,
          cx + Math.cos(a - 0.08) * 120,
          cy + Math.sin(a - 0.08) * 120,
          cx + Math.cos(a + 0.08) * 120,
          cy + Math.sin(a + 0.08) * 120,
        ])
        .fill({ color: i % 2 ? VIOLET : colors.gold, alpha: 0.18 });
    }
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      this.wheel
        .moveTo(0, 0)
        .arc(0, 0, WHEEL_RADIUS, a0, a1)
        .closePath()
        .fill(WHEEL_COLORS[i % WHEEL_COLORS.length]!)
        .moveTo(0, 0)
        .lineTo(Math.cos(a0) * WHEEL_RADIUS, Math.sin(a0) * WHEEL_RADIUS)
        .stroke({ color: 0xfff1a8, width: 1.2 });
    }
    this.wheel
      .circle(0, 0, WHEEL_RADIUS)
      .stroke({ color: colors.gold, width: 5 })
      .circle(0, 0, WHEEL_RADIUS - 3)
      .stroke({ color: 0xfff1a8, width: 1, alpha: 0.8 })
      .circle(0, 0, 14)
      .fill(0x2a0d48)
      .stroke({ color: colors.gold, width: 3 });
    star(this.wheel, 0, 0, 10);
    this.wheel.position.set(cx, cy);
    const ring = new Container();
    for (let i = 0; i < WHEEL_BULBS; i++) {
      const a = (i / WHEEL_BULBS) * Math.PI * 2;
      const bulb = new Graphics()
        .circle(0, 0, 4.5)
        .fill({ color: 0xfff1a8, alpha: 0.25 })
        .circle(0, 0, 2.2)
        .fill(0xffffff);
      bulb.position.set(
        cx + Math.cos(a) * (WHEEL_RADIUS + 6),
        cy + Math.sin(a) * (WHEEL_RADIUS + 6),
      );
      this.bulbs.push(bulb);
      ring.addChild(bulb);
    }
    const pointer = new Graphics()
      .poly([-9, -2, 9, -2, 0, 15])
      .fill(colors.gold)
      .stroke({ color: 0x7a4a00, width: 1.5, join: 'round' })
      .circle(0, 0, 4)
      .fill(0xfff1a8);
    pointer.position.set(cx, cy - WHEEL_RADIUS - 6);
    this.addChild(rays, ring, this.wheel, pointer);
  }

  update(seconds: number): void {
    this.clock += seconds;
    if (this.clock > 4) {
      this.clock = 0;
      this.velocity = 9;
    }
    this.velocity = this.clock < 3 ? this.velocity * Math.pow(0.45, seconds) : 0;
    this.wheel.rotation += this.velocity * seconds;
    // The bulbs chase while it spins and blink together once it stops.
    this.chase += seconds * (this.velocity > 0.2 ? 12 : 0);
    const stopped = this.clock >= 3;
    const blink = Math.floor(this.clock * 6) % 2 === 0;
    this.bulbs.forEach((bulb, i) => {
      bulb.alpha = stopped ? (blink ? 1 : 0.3) : (Math.floor(this.chase) + i) % 4 === 0 ? 1 : 0.35;
    });
  }
}

type ScratchSymbol = 'star' | 'gem' | 'clover' | 'cherry' | 'coin';

/** The card: three stars (the win) among other symbols, and the order the tiles are scratched. */
const CARD: ScratchSymbol[] = [
  'gem',
  'star',
  'clover',
  'cherry',
  'star',
  'coin',
  'clover',
  'star',
  'gem',
];
const SCRATCH_ORDER = [1, 3, 4, 0, 7, 5];
/** Per tile, its place in SCRATCH_ORDER (-1 if it's never scratched). */
const SCRATCH_STEP = CARD.map((_, i) => SCRATCH_ORDER.indexOf(i));
const TILE_W = 44;
const TILE_H = 34;
const TILE_GAP = 6;
const TILE_TIME = 0.42;

/** A 3×3 scratch card: a coin scratches tiles one by one until three stars light up. */
class ScratchAttract extends Container implements Attract {
  private readonly foils: Graphics[] = [];
  private readonly glows: Graphics[] = [];
  private readonly scratcher = new Graphics();
  private readonly origins: { x: number; y: number }[] = [];
  private clock = 0;

  constructor() {
    super();
    const left = (SCREEN_WIDTH - TILE_W * 3 - TILE_GAP * 2) / 2;
    const top = (SCREEN_HEIGHT - TILE_H * 3 - TILE_GAP * 2) / 2;
    const card = new Graphics();
    const symbols = new Graphics();
    const glowLayer = new Container();
    const foilLayer = new Container();
    CARD.forEach((kind, i) => {
      const x = left + (i % 3) * (TILE_W + TILE_GAP);
      const y = top + Math.floor(i / 3) * (TILE_H + TILE_GAP);
      this.origins.push({ x, y });
      card
        .roundRect(x, y, TILE_W, TILE_H, 4)
        .fill(0x1a0b3a)
        .stroke({ color: 0x5b3a9a, width: 1.5 });
      const glow = new Graphics()
        .roundRect(x - 1, y - 1, TILE_W + 2, TILE_H + 2, 5)
        .fill({ color: colors.gold, alpha: 0.35 })
        .stroke({ color: colors.gold, width: 2 });
      glow.visible = false;
      this.glows.push(glow);
      glowLayer.addChild(glow);
      const cx = x + TILE_W / 2;
      const cy = y + TILE_H / 2;
      if (kind === 'star') star(symbols, cx, cy + 1, 12);
      else if (kind === 'gem') gem(symbols, cx, cy, 10);
      else if (kind === 'clover') clover(symbols, cx, cy - 2, 12);
      else if (kind === 'cherry') cherries(symbols, cx - 1, cy - 2, 8);
      else coin(symbols, cx, cy, 9);
      // Silver foil with a diagonal sheen.
      const foil = new Graphics().roundRect(x, y, TILE_W, TILE_H, 4).fill(
        vertical([
          [0, 0xe3e6ee],
          [1, 0x8f93a3],
        ]),
      );
      for (let s = -2; s < 4; s++) {
        const sx = x + s * 12;
        foil
          .moveTo(Math.max(x, sx), sx < x ? y + (x - sx) : y)
          .lineTo(
            Math.min(x + TILE_W, sx + TILE_H),
            sx + TILE_H > x + TILE_W ? y + (x + TILE_W - sx) : y + TILE_H,
          )
          .stroke({ color: 0xffffff, width: 1, alpha: 0.35 });
      }
      this.foils.push(foil);
      foilLayer.addChild(foil);
    });
    this.scratcher.circle(0, 0, 7).fill(colors.gold).stroke({ color: 0xb8901a, width: 2 });
    this.addChild(card, glowLayer, symbols, foilLayer, this.scratcher);
  }

  update(seconds: number): void {
    const scratchEnd = SCRATCH_ORDER.length * TILE_TIME;
    this.clock = (this.clock + seconds) % (scratchEnd + 1.6);
    const step = Math.floor(this.clock / TILE_TIME);
    const progress = (this.clock % TILE_TIME) / TILE_TIME;
    this.foils.forEach((foil, i) => {
      const order = SCRATCH_STEP[i]!;
      if (order < 0) foil.alpha = 1;
      else if (order < step) foil.alpha = 0;
      else if (order === step) foil.alpha = 1 - progress * 0.95;
      else foil.alpha = 1;
    });
    // The coin zig-zags across the tile it's scratching.
    const tile = SCRATCH_ORDER[step];
    this.scratcher.visible = tile !== undefined;
    if (tile !== undefined) {
      const { x, y } = this.origins[tile]!;
      const zig = Math.abs(((progress * 3) % 2) - 1);
      this.scratcher.position.set(x + 6 + zig * (TILE_W - 12), y + 6 + progress * (TILE_H - 12));
    }
    const won = this.clock > scratchEnd && Math.floor(this.clock * 6) % 2 === 0;
    this.glows.forEach((glow, i) => (glow.visible = won && CARD[i] === 'star'));
  }
}

/** A chrome rocket pointing along +x, origin at its middle. */
function rocket(): Container {
  const body = new Graphics()
    .poly([-10, -4, -16, -11, -6, -5])
    .fill(RED)
    .poly([-10, 4, -16, 11, -6, 5])
    .fill(RED)
    .poly([-12, -5, 6, -6, 15, 0, 6, 6, -12, 5])
    .fill(
      vertical([
        [0, 0xffffff],
        [0.5, 0xb9bccc],
        [1, 0x5f6378],
      ]),
    )
    .poly([6, -6, 15, 0, 6, 6])
    .fill(RED)
    .circle(0, 0, 3.2)
    .fill(colors.cyan)
    .stroke({ color: 0x1d2a44, width: 1.2 });
  return new Container({ children: [body] });
}

/** The multiplier climbing as a rocket rides the curve up through space, until it blows up. */
class CrashAttract extends Container implements Attract {
  private readonly curve = new Graphics();
  private readonly rocket = rocket();
  private readonly flame = new Graphics();
  private readonly boom = new Graphics();
  private readonly readout: BitmapText;
  private clock = 0;
  private crashAt = 3;

  constructor() {
    super();
    const sky = new Graphics();
    for (let x = 20; x < SCREEN_WIDTH; x += 20) {
      sky.moveTo(x, 0).lineTo(x, SCREEN_HEIGHT);
    }
    for (let y = 10; y < SCREEN_HEIGHT; y += 20) {
      sky.moveTo(0, y).lineTo(SCREEN_WIDTH, y);
    }
    sky.stroke({ color: 0x3a6cff, width: 1, alpha: 0.22 });
    for (let i = 0; i < 14; i++) {
      sky
        .circle((i * 67) % SCREEN_WIDTH, (i * 41) % SCREEN_HEIGHT, i % 3 ? 0.8 : 1.4)
        .fill(0xffffff);
    }
    // A ringed planet top left, a small moon on the right.
    sky
      .circle(30, 38, 16)
      .fill(0x6a2bbf)
      .circle(25, 33, 7)
      .fill({ color: 0xc58cff, alpha: 0.35 })
      .ellipse(30, 40, 27, 5)
      .stroke({ color: 0xff7ad9, width: 2, alpha: 0.8 })
      .circle(136, 70, 6)
      .fill(0x8a4dff);
    this.readout = new BitmapText({
      text: '',
      style: { fontFamily: displayFont, fontSize: 20, fontWeight: '700', fill: 0xffffff },
    });
    this.readout.anchor.set(0.5, 0);
    this.readout.position.set(SCREEN_WIDTH / 2, 8);
    this.rocket.addChildAt(this.flame, 0);
    this.addChild(sky, this.curve, this.rocket, this.boom, this.readout);
  }

  update(seconds: number): void {
    this.clock += seconds;
    if (this.clock > this.crashAt + 1) {
      this.clock = 0;
      this.crashAt = 2 + Math.random() * 2;
    }
    const t = Math.min(this.clock, this.crashAt);
    const crashed = this.clock > this.crashAt;
    const color = crashed ? RED : colors.gold;
    // The longest run (4) ends at x = 128, leaving room for the rocket's nose and the burst.
    const at = (x: number) => ({ x: 10 + (x / 4) * 118, y: 120 - (Math.exp(0.5 * x) - 1) * 14 });
    this.curve.clear();
    const points: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const p = at((i / 24) * t);
      points.push(p.x, p.y);
    }
    this.curve
      .poly(points, false)
      .stroke({ color, width: 7, alpha: 0.25 })
      .poly(points, false)
      .stroke({ color, width: 3 });

    // The rocket rides the tip, nose along the curve, with a flickering exhaust.
    const tip = at(t);
    const ahead = at(t + 0.05);
    this.rocket.visible = !crashed;
    this.rocket.position.set(tip.x, tip.y);
    this.rocket.rotation = Math.atan2(ahead.y - tip.y, ahead.x - tip.x);
    const length = 10 + Math.random() * 7;
    this.flame
      .clear()
      .poly([-11, -4, -11 - length, 0, -11, 4])
      .fill(ORANGE)
      .poly([-11, -2, -11 - length * 0.55, 0, -11, 2])
      .fill(0xfff1a8);

    // On the crash, a burst where the rocket was.
    this.boom.clear();
    if (crashed) {
      const b = Math.min(1, (this.clock - this.crashAt) / 0.5);
      this.boom.position.set(tip.x, tip.y);
      this.boom
        .circle(0, 0, 6 + b * 18)
        .fill({ color: ORANGE, alpha: 0.6 * (1 - b) })
        .circle(0, 0, 3 + b * 9)
        .fill({ color: 0xfff1a8, alpha: 1 - b });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.boom
          .circle(Math.cos(a) * b * 26, Math.sin(a) * b * 26, 2)
          .fill({ color: RED, alpha: 1 - b });
      }
    }
    this.readout.text = `${Math.exp(0.5 * t).toFixed(2)}×`;
    this.readout.tint = color;
  }
}

const WOOD = 0x7a3e1d;
const METAL = 0xd9a520;
const CHEST_W = 66;
const CHEST_Y = 112;
const CYCLE = 3.6;
const OPEN_AT = 0.9;
const CLOSE_AT = 3.1;

/** The bonus round in miniature: Lucky (the coin mascot) hops while the chest bursts with coins. */
class BonusAttract extends Container implements Attract {
  private readonly rays = new Graphics();
  private readonly chest = new Container();
  private readonly lid = new Graphics();
  private readonly coins = new Graphics();
  private readonly mascot = new Graphics();
  private clock = 0;

  constructor() {
    super();
    const cx = SCREEN_WIDTH / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.rays
        .poly([
          0,
          0,
          Math.cos(a - 0.12) * 110,
          Math.sin(a - 0.12) * 110,
          Math.cos(a + 0.12) * 110,
          Math.sin(a + 0.12) * 110,
        ])
        .fill({ color: colors.gold, alpha: 0.22 });
    }
    this.rays.position.set(cx, CHEST_Y - 34);
    const base = new Graphics()
      .roundRect(-CHEST_W / 2, -36, CHEST_W, 36, 3)
      .fill(WOOD)
      .rect(-CHEST_W / 2, -36, CHEST_W, 4)
      .fill(0x2b1a0a)
      .rect(-CHEST_W / 2, -36, 7, 36)
      .fill(METAL)
      .rect(CHEST_W / 2 - 7, -36, 7, 36)
      .fill(METAL)
      .roundRect(-6, -30, 12, 14, 2)
      .fill(METAL)
      .circle(0, -24, 2.2)
      .fill(0x2b1a0a);
    // The lid's bottom edge is y = 0 in lid space; open, it pops up and tips back.
    this.lid
      .roundRect(-CHEST_W / 2 - 2, -20, CHEST_W + 4, 20, 9)
      .fill(0x8b4a22)
      .rect(-CHEST_W / 2 + 5, -20, 7, 20)
      .fill(METAL)
      .rect(CHEST_W / 2 - 12, -20, 7, 20)
      .fill(METAL)
      .rect(-CHEST_W / 2 - 2, -3, CHEST_W + 4, 3)
      .fill(METAL);
    this.lid.y = -36;
    const glow = new Graphics()
      .ellipse(0, -36, CHEST_W / 2 - 4, 6)
      .fill({ color: 0xfff1a8, alpha: 0.9 });
    this.chest.addChild(base, glow, this.lid);
    this.chest.position.set(cx, CHEST_Y);
    // Lucky: the bonus game's coin mascot, small.
    coin(this.mascot, 0, 0, 15);
    this.mascot
      .circle(-5, -3, 2.2)
      .fill(0x2b1a0a)
      .circle(5, -3, 2.2)
      .fill(0x2b1a0a)
      .moveTo(-6, 4)
      .quadraticCurveTo(0, 10, 6, 4)
      .stroke({ color: 0x2b1a0a, width: 2, cap: 'round' });
    this.mascot.position.set(30, CHEST_Y - 16);
    this.addChild(this.rays, this.coins, this.chest, this.mascot);
  }

  update(seconds: number): void {
    this.clock = (this.clock + seconds) % CYCLE;
    const open = this.clock > OPEN_AT && this.clock < CLOSE_AT;
    // Closed it wobbles in anticipation; open, the lid flips up and the rays turn.
    this.chest.rotation = open
      ? 0
      : Math.sin(this.clock * 40) * 0.04 * Math.min(1, this.clock / OPEN_AT);
    this.lid.y = open ? -46 : -36;
    this.lid.rotation = open ? -0.28 : 0;
    this.rays.visible = open;
    this.rays.rotation += seconds * 0.6;
    this.mascot.y = CHEST_Y - 16 - Math.abs(Math.sin(this.clock * 5)) * (open ? 18 : 6);
    this.mascot.rotation = open ? Math.sin(this.clock * 10) * 0.2 : 0;

    // Coins fountain out of the chest on arcs while it's open.
    this.coins.clear();
    if (!open) return;
    const t = this.clock - OPEN_AT;
    for (let i = 0; i < 12; i++) {
      const life = (t * 1.2 + i / 12) % 1;
      const angle = -Math.PI / 2 + ((i * 37) % 13) / 13 - 0.5;
      const speed = 95 + ((i * 53) % 40);
      const x = SCREEN_WIDTH / 2 + Math.cos(angle) * speed * life;
      const y = CHEST_Y - 38 + Math.sin(angle) * speed * life + 160 * life * life;
      const spin = Math.abs(Math.cos(this.clock * 8 + i));
      this.coins
        .ellipse(x, y, 5 * spin + 0.5, 5)
        .fill(colors.gold)
        .stroke({ color: 0xb8901a, width: 1 });
    }
  }
}

export function createAttract(game: GameInfo['id']): Attract {
  switch (game) {
    case 'slot':
      return new SlotAttract();
    case 'wheel':
      return new WheelAttract();
    case 'scratch':
      return new ScratchAttract();
    case 'crash':
      return new CrashAttract();
    case 'bonus':
      return new BonusAttract();
  }
}

/** Shared symbol drawing for the cabinets' marquee emblems. */
export const draw = { star, gem, cherries, coin, rocket };

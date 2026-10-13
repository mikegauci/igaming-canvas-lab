import { chromeFill, colors, metalFill } from '@lab/core';
import { BitmapText, Container, FillGradient, Graphics, Text } from 'pixi.js';
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
const ORANGE = 0xff7a1a;
const CHERRY = 0xe8173a;
const PINK_LIGHT = 0xff8bd0;
const CYAN_LIGHT = 0xa1f8ff;
/** The games' dark screen and enamel colours. */
const SCREEN_BG = 0x0b0a1f;

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

/** A gold coin, seen face-on (squash it on x to spin it). */
function coin(g: Graphics, x: number, y: number, r: number): Graphics {
  return g
    .circle(x, y, r)
    .fill(colors.gold)
    .stroke({ color: 0xb8901a, width: Math.max(1, r * 0.22) })
    .circle(x - r * 0.3, y - r * 0.3, r * 0.25)
    .fill({ color: 0xffffff, alpha: 0.6 });
}

/** A chrome rocket with red fins, like the Crash game's, pointing along +x, origin at its middle. */
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
    .circle(0, 0, 3.4)
    .fill(0x0d1a3a)
    .stroke({ color: RED, width: 1.2 })
    .circle(0, 0, 2)
    .fill(colors.cyan);
  return new Container({ children: [body] });
}

/** Metal bezel with a neon inner line, the frame every game puts round its play area. */
function bezel(g: Graphics, x: number, y: number, w: number, h: number, r: number): Graphics {
  return g
    .roundRect(x - 3, y - 3, w + 6, h + 6, r + 2)
    .fill(metalFill())
    .stroke({ color: 0xabb7d4, width: 1 })
    .roundRect(x, y, w, h, r)
    .fill(SCREEN_BG)
    .stroke({ color: colors.neon, width: 1.5, alpha: 0.9 });
}

// --- Mini Slot -------------------------------------------------------------------------------

/**
 * The Mini Slot symbols, drawn on the same 150-unit canvas as the game's symbol textures
 * (apps/slot/src/view/symbol-textures.ts) and scaled down to reel size.
 */
type SlotSymbol = 'seven' | 'cherry' | 'bell' | 'diamond' | 'bar' | 'lemon';

const SYMBOL_CANVAS = 150;
const outline = { color: 0x17162c, width: 3, join: 'round' as const };
const goldFill = () =>
  vertical([
    [0, 0xfff9b4],
    [0.3, 0xffdb55],
    [0.6, 0xefa724],
    [1, 0xa45316],
  ]);

const SLOT_ART: Record<SlotSymbol, () => Container> = {
  cherry: () => {
    const g = new Graphics();
    for (const [x, y] of [
      [54, 93],
      [98, 96],
    ] as const) {
      g.moveTo(x, y)
        .bezierCurveTo(x, 64, 82, 51, 84, 30)
        .stroke({ color: 0x173e35, width: 8, cap: 'round' })
        .moveTo(x - 1, y)
        .bezierCurveTo(x - 1, 64, 82, 51, 84, 30)
        .stroke({ color: 0x55dc87, width: 3, cap: 'round' });
    }
    return g
      .moveTo(83, 33)
      .bezierCurveTo(96, 13, 120, 20, 126, 30)
      .bezierCurveTo(108, 49, 92, 44, 83, 33)
      .fill(0x29b96c)
      .stroke(outline)
      .circle(53, 104, 25)
      .fill(
        vertical([
          [0, 0xff779a],
          [0.3, 0xed205b],
          [1, 0x790c35],
        ]),
      )
      .stroke(outline)
      .circle(98, 108, 25)
      .fill(
        vertical([
          [0, 0xff97b3],
          [0.3, 0xff306a],
          [1, 0xa70d42],
        ]),
      )
      .stroke(outline)
      .ellipse(44, 94, 8, 5)
      .fill({ color: 0xffffff, alpha: 0.75 })
      .ellipse(88, 98, 8, 5)
      .fill({ color: 0xffffff, alpha: 0.75 });
  },
  lemon: () =>
    new Graphics()
      .moveTo(24, 76)
      .bezierCurveTo(35, 76, 32, 41, 74, 39)
      .bezierCurveTo(111, 37, 118, 71, 127, 76)
      .bezierCurveTo(118, 84, 115, 111, 75, 115)
      .bezierCurveTo(37, 113, 36, 86, 24, 76)
      .fill(goldFill())
      .stroke(outline)
      .ellipse(62, 57, 21, 9)
      .fill({ color: 0xfffddd, alpha: 0.85 }),
  bell: () =>
    new Graphics()
      .circle(75, 29, 8)
      .fill(goldFill())
      .stroke(outline)
      .circle(75, 117, 10)
      .fill(goldFill())
      .stroke(outline)
      .moveTo(38, 103)
      .bezierCurveTo(40, 58, 51, 36, 75, 35)
      .bezierCurveTo(98, 36, 110, 58, 112, 103)
      .lineTo(124, 114)
      .lineTo(26, 114)
      .closePath()
      .fill(goldFill())
      .stroke(outline)
      .roundRect(50, 52, 11, 43, 5)
      .fill({ color: 0xfffddd, alpha: 0.8 }),
  bar: () => {
    const g = new Graphics()
      .roundRect(14, 48, 122, 62, 10)
      .fill(0x101224)
      .stroke(outline)
      .roundRect(14, 43, 122, 62, 10)
      .fill(goldFill())
      .stroke(outline)
      .roundRect(20, 49, 110, 50, 6)
      .fill(
        vertical([
          [0, 0x525471],
          [0.4, 0x1d203b],
          [1, 0x080b1c],
        ]),
      );
    const label = new Text({
      text: 'BAR',
      style: { fontFamily: displayFont, fontSize: 32, fontWeight: '900', fill: goldFill() },
    });
    label.anchor.set(0.5);
    label.position.set(75, 75);
    return new Container({ children: [g, label] });
  },
  seven: () => {
    const label = new Text({
      text: '7',
      style: {
        fontFamily: displayFont,
        fontStyle: 'italic',
        fontSize: 96,
        fontWeight: '900',
        fill: vertical([
          [0, 0xffb2dd],
          [0.22, 0xff398b],
          [0.55, 0xe70850],
          [1, 0x890a4c],
        ]),
        stroke: { color: 0xf0f5ff, width: 7, join: 'round' },
        padding: 6,
      },
    });
    label.anchor.set(0.5);
    label.position.set(71, 77);
    return new Container({ children: [label] });
  },
  diamond: () =>
    new Graphics()
      .poly([43, 36, 107, 36, 132, 65, 75, 126, 18, 65])
      .fill(0x15cbea)
      .stroke(outline)
      .poly([43, 36, 107, 36, 94, 65, 56, 65])
      .fill(0xc0faff)
      .poly([18, 65, 43, 36, 56, 65])
      .fill(0x75e6ff)
      .poly([107, 36, 132, 65, 94, 65])
      .fill(0x53a8f7)
      .poly([18, 65, 56, 65, 75, 126])
      .fill(0x219bbd)
      .poly([56, 65, 94, 65, 75, 126])
      .fill(0x66f1ff)
      .poly([94, 65, 132, 65, 75, 126])
      .fill(0x247ada)
      .moveTo(18, 65)
      .lineTo(132, 65)
      .moveTo(43, 36)
      .lineTo(56, 65)
      .lineTo(75, 126)
      .lineTo(94, 65)
      .lineTo(107, 36)
      .stroke({ color: 0xf0ffff, width: 2, alpha: 0.85 }),
};

/** The reel strip, top to bottom. A win stops each reel on strip[0], the seven. */
const STRIP: SlotSymbol[] = ['seven', 'cherry', 'bell', 'diamond', 'bar', 'lemon'];
const REEL_WIDTH = 44;
const REEL_GAP = 4;
const ROW = 38;
const REEL_SPEED = 9;
const REEL_TOP = 8;

function slotSymbol(kind: SlotSymbol): Container {
  const art = SLOT_ART[kind]();
  art.pivot.set(SYMBOL_CANVAS / 2, 78);
  art.scale.set((ROW - 4) / SYMBOL_CANVAS);
  return new Container({ children: [art] });
}

/** Three silver reels in a neon-edged metal bezel: spin, stop left to right on 7-7-7, flash. */
class SlotAttract extends Container implements Attract {
  /** Per reel, per visible row, one copy of each symbol (only the current one is shown). */
  private readonly cells: Map<SlotSymbol, Container>[][] = [];
  private readonly payline = new Graphics();
  private clock = 0;

  constructor() {
    super();
    const width = REEL_WIDTH * 3 + REEL_GAP * 2;
    const left = (SCREEN_WIDTH - width) / 2;
    const height = SCREEN_HEIGHT - REEL_TOP * 2;
    const frame = bezel(new Graphics(), left - 4, REEL_TOP - 4, width + 8, height + 8, 6);
    const backs = new Graphics();
    const shade = new Graphics();
    const symbols = new Container();
    for (let i = 0; i < 3; i++) {
      const x = left + i * (REEL_WIDTH + REEL_GAP);
      backs
        .roundRect(x, REEL_TOP, REEL_WIDTH, height, 4)
        .fill(
          vertical([
            [0, 0x7d7f99],
            [0.18, 0xdfe2ec],
            [0.5, 0xffffff],
            [0.82, 0xdfe2ec],
            [1, 0x7d7f99],
          ]),
        )
        .stroke({ color: 0x3a3d58, width: 1 });
      // The drum curves away at the top and bottom.
      shade
        .rect(x, REEL_TOP, REEL_WIDTH, 14)
        .fill({ color: 0x16152a, alpha: 0.3 })
        .rect(x, REEL_TOP + height - 14, REEL_WIDTH, 14)
        .fill({ color: 0x16152a, alpha: 0.3 });
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
    // Cyan payline markers on both sides of each row, like the game's reel window.
    for (const row of [-1, 0, 1]) {
      const y = SCREEN_HEIGHT / 2 + row * ROW;
      shade
        .poly([left - 4, y - 3, left - 0.5, y, left - 4, y + 3])
        .fill(colors.cyan)
        .poly([left + width + 4, y - 3, left + width + 0.5, y, left + width + 4, y + 3])
        .fill(colors.cyan);
    }
    const mask = new Graphics().rect(left, REEL_TOP, width, height).fill(0xffffff);
    symbols.mask = mask;
    this.payline.visible = false;
    this.addChild(frame, backs, symbols, mask, shade, this.payline);
    this.payline
      .rect(left - 2, SCREEN_HEIGHT / 2 - 1, width + 4, 2)
      .fill(colors.gold)
      .roundRect(left - 1, SCREEN_HEIGHT / 2 - ROW / 2, width + 2, ROW, 4)
      .stroke({ color: colors.neon, width: 2 })
      .roundRect(left - 1, SCREEN_HEIGHT / 2 - ROW / 2, width + 2, ROW, 4)
      .fill({ color: colors.gold, alpha: 0.18 });
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

// --- Lucky Wheel -----------------------------------------------------------------------------

/** The game's 12 segments in order, with its dark enamel faces and neon edges. */
const WHEEL_SEGMENTS = [1, 5, 0, 2, 10, 1, 0, 3, 50, 1, 0, 2];
const SEGMENT_STYLE: Record<number, { fill: number; edge: number }> = {
  0: { fill: 0x141526, edge: 0x5c5b80 },
  1: { fill: 0x23274e, edge: 0x8198ee },
  2: { fill: 0x432066, edge: 0xb66dff },
  3: { fill: 0x7b2059, edge: colors.neon },
  5: { fill: 0x8b3b28, edge: 0xff9557 },
  10: { fill: 0x47d9ef, edge: 0xc7fbff },
  50: { fill: colors.gold, edge: 0xfff1b0 },
};
const WHEEL_RADIUS = 44;
const WHEEL_BULBS = 16;

/** The cosmic prize wheel: chasing cyan/pink rim lights, spins up, coasts down, flashes gold. */
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
    // Gold and violet starburst behind the wheel, like the Cosmic Luck art.
    const rays = new Graphics();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      rays
        .poly([
          cx,
          cy,
          cx + Math.cos(a - 0.1) * 130,
          cy + Math.sin(a - 0.1) * 130,
          cx + Math.cos(a + 0.1) * 130,
          cy + Math.sin(a + 0.1) * 130,
        ])
        .fill({ color: i % 2 ? 0x8a4dff : colors.gold, alpha: 0.14 });
    }
    for (let i = 0; i < 12; i++) {
      rays.circle((i * 67 + 9) % SCREEN_WIDTH, (i * 43 + 5) % SCREEN_HEIGHT, i % 3 ? 0.7 : 1.2);
    }
    rays.fill({ color: 0xffffff, alpha: 0.7 });

    // Metal rim with a neon line, behind the face.
    const rim = new Graphics()
      .circle(cx, cy + 1.5, WHEEL_RADIUS + 11)
      .fill(0x050611)
      .circle(cx, cy, WHEEL_RADIUS + 9)
      .fill(metalFill())
      .stroke({ color: 0xabb7d4, width: 1 })
      .circle(cx, cy, WHEEL_RADIUS + 5)
      .fill(0x101126)
      .stroke({ color: colors.neon, width: 1.5 });

    const w = (Math.PI * 2) / WHEEL_SEGMENTS.length;
    WHEEL_SEGMENTS.forEach((multiplier, i) => {
      const style = SEGMENT_STYLE[multiplier]!;
      const a0 = i * w - Math.PI / 2;
      const a1 = a0 + w;
      this.wheel
        .moveTo(0, 0)
        .arc(0, 0, WHEEL_RADIUS, a0, a1)
        .closePath()
        .fill(style.fill)
        // Inset enamel window, so the metal spokes show between prizes.
        .moveTo(Math.cos(a0 + 0.06) * 17, Math.sin(a0 + 0.06) * 17)
        .arc(0, 0, WHEEL_RADIUS - 5, a0 + 0.06, a1 - 0.06)
        .arc(0, 0, 17, a1 - 0.06, a0 + 0.06, true)
        .closePath()
        .stroke({ color: style.edge, width: 1, alpha: 0.75 });
    });
    for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
      const a = i * w - Math.PI / 2;
      this.wheel
        .moveTo(0, 0)
        .lineTo(Math.cos(a) * WHEEL_RADIUS, Math.sin(a) * WHEEL_RADIUS)
        .stroke({ color: 0xadb8d2, width: 1.2, alpha: 0.8 })
        .circle(Math.cos(a) * (WHEEL_RADIUS - 3), Math.sin(a) * (WHEEL_RADIUS - 3), 1.6)
        .fill(0xe8f3ff);
    }
    this.wheel.circle(0, 0, WHEEL_RADIUS).stroke({ color: 0xc6cce0, width: 1.5 });
    this.wheel.position.set(cx, cy);

    // Chrome star hub on a neon-ringed disc.
    const hub = new Graphics()
      .circle(cx, cy, 15)
      .fill(metalFill())
      .stroke({ color: 0xd1dbef, width: 1 })
      .circle(cx, cy, 12)
      .fill(0x171126)
      .stroke({ color: colors.neon, width: 1 })
      .star(cx, cy, 5, 8.5, 3.8)
      .fill(chromeFill())
      .stroke({ color: colors.gold, width: 0.8 });

    const ring = new Container();
    for (let i = 0; i < WHEEL_BULBS; i++) {
      const a = (i / WHEEL_BULBS) * Math.PI * 2;
      const bulb = new Graphics()
        .circle(0, 0, 3.6)
        .fill({ color: 0xffffff, alpha: 0.18 })
        .circle(0, 0, 2)
        .fill(0xffffff);
      bulb.position.set(
        cx + Math.cos(a) * (WHEEL_RADIUS + 7),
        cy + Math.sin(a) * (WHEEL_RADIUS + 7),
      );
      this.bulbs.push(bulb);
      ring.addChild(bulb);
    }
    const pointer = new Graphics()
      .poly([-7, -1, 7, -1, 0, 13])
      .fill(chromeFill())
      .stroke({ color: colors.neon, width: 1.2, join: 'round' })
      .circle(0, 0, 3.6)
      .fill(metalFill())
      .stroke({ color: 0xe7f5ff, width: 1 });
    pointer.position.set(cx, cy - WHEEL_RADIUS - 9);
    this.addChild(rays, rim, ring, this.wheel, hub, pointer);
  }

  update(seconds: number): void {
    this.clock += seconds;
    if (this.clock > 4) {
      this.clock = 0;
      this.velocity = 9;
    }
    this.velocity = this.clock < 3 ? this.velocity * Math.pow(0.45, seconds) : 0;
    this.wheel.rotation += this.velocity * seconds;
    // Cyan and pink bulbs chase while it spins; once it stops they all flash gold together.
    this.chase += seconds * (this.velocity > 0.2 ? 12 : 0);
    const stopped = this.clock >= 3;
    const blink = Math.floor(this.clock * 6) % 2 === 0;
    this.bulbs.forEach((bulb, i) => {
      const on = stopped ? blink : (Math.floor(this.chase) + i) % 2 === 0;
      bulb.tint = !on ? 0x43405e : stopped ? colors.gold : i % 2 ? PINK_LIGHT : CYAN_LIGHT;
      bulb.alpha = on ? 1 : 0.6;
    });
  }
}

// --- Scratch Card ----------------------------------------------------------------------------

/** Prize coins as the game colours them: bronze, silver, gold, cyan, pink and the 100× jackpot. */
const COIN_STYLE: Record<number, { coin: number; rim: number }> = {
  1: { coin: 0xcd8a4a, rim: 0x8a5a2b },
  2: { coin: 0xd5d9e0, rim: 0x8c929c },
  5: { coin: colors.gold, rim: 0xb8901a },
  10: { coin: colors.cyan, rim: 0x1fa3b3 },
  20: { coin: colors.neon, rim: 0xa8216b },
  100: { coin: 0x7b2ff7, rim: colors.gold },
};
/** The card: three ×10 coins (the win) among other prizes, and the order tiles are scratched. */
const CARD = [20, 10, 2, 5, 10, 100, 1, 10, 20];
const SCRATCH_ORDER = [1, 3, 4, 0, 7, 5];
/** Per tile, its place in SCRATCH_ORDER (-1 if it's never scratched). */
const SCRATCH_STEP = CARD.map((_, i) => SCRATCH_ORDER.indexOf(i));
const TILE_W = 42;
const TILE_H = 32;
const TILE_GAP = 5;
const TILE_TIME = 0.42;

/** The Diamond Dust card: a coin scratches the holographic foil until three ×10 coins light up. */
class ScratchAttract extends Container implements Attract {
  private readonly foils: Graphics[] = [];
  private readonly glows: Graphics[] = [];
  private readonly scratcher = new Graphics();
  private readonly origins: { x: number; y: number }[] = [];
  private clock = 0;

  constructor() {
    super();
    const gridW = TILE_W * 3 + TILE_GAP * 2;
    const gridH = TILE_H * 3 + TILE_GAP * 2;
    const left = (SCREEN_WIDTH - gridW) / 2;
    const top = (SCREEN_HEIGHT - gridH) / 2;
    const card = bezel(new Graphics(), left - 6, top - 6, gridW + 12, gridH + 12, 8);
    const coins = new Graphics();
    const glowLayer = new Container();
    const foilLayer = new Container();
    CARD.forEach((prize, i) => {
      const x = left + (i % 3) * (TILE_W + TILE_GAP);
      const y = top + Math.floor(i / 3) * (TILE_H + TILE_GAP);
      this.origins.push({ x, y });
      card
        .roundRect(x, y, TILE_W, TILE_H, 4)
        .fill(i % 2 ? 0x1b1934 : 0x161830)
        .stroke({ color: colors.cyan, width: 1, alpha: 0.35 });
      const glow = new Graphics()
        .roundRect(x - 1, y - 1, TILE_W + 2, TILE_H + 2, 5)
        .fill({ color: colors.gold, alpha: 0.35 })
        .stroke({ color: colors.neon, width: 2 });
      glow.visible = false;
      this.glows.push(glow);
      glowLayer.addChild(glow);
      const style = COIN_STYLE[prize]!;
      const cx = x + TILE_W / 2;
      const cy = y + TILE_H / 2;
      coins
        .circle(cx, cy, 11)
        .fill(style.coin)
        .stroke({ color: style.rim, width: 1.6 })
        .circle(cx, cy, 8)
        .stroke({ color: style.rim, width: 0.8, alpha: 0.6 })
        .ellipse(cx - 2, cy - 5.5, 5, 1.8)
        .fill({ color: 0xffffff, alpha: 0.35 });
      if (prize === 100) star(coins, cx, cy + 0.5, 6);
      // Holographic silver foil with cyan and pink sheen bands.
      const foil = new Graphics().roundRect(x, y, TILE_W, TILE_H, 4).fill(
        vertical([
          [0, 0xdfe6f5],
          [0.4, 0xaab3c9],
          [0.6, 0xc9c3e0],
          [1, 0x9aa3bb],
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
          .stroke({
            color: [CYAN_LIGHT, PINK_LIGHT, 0xffffff][(s + 3) % 3]!,
            width: 2.5,
            alpha: 0.35,
          });
      }
      foil.roundRect(x + 3, y + 3, TILE_W - 6, TILE_H - 6, 3).stroke({
        color: 0x6f7591,
        width: 1,
        alpha: 0.5,
      });
      this.foils.push(foil);
      foilLayer.addChild(foil);
    });
    coin(this.scratcher, 0, 0, 6);
    this.addChild(card, glowLayer, coins, foilLayer, this.scratcher);
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
    this.glows.forEach((glow, i) => (glow.visible = won && CARD[i] === 10));
  }
}

// --- Crash -----------------------------------------------------------------------------------

/** Curve colour by multiplier, as in the game: white, then gold from 2×, cyan from 5×. */
const tierColor = (multiplier: number): number =>
  multiplier >= 5 ? colors.cyan : multiplier >= 2 ? colors.gold : 0xffffff;

/** The Sunset Launch chart: the multiplier climbs as the rocket rides the curve, until it blows. */
class CrashAttract extends Container implements Attract {
  private readonly area = new Graphics();
  private readonly curve = new Graphics();
  private readonly rocket = rocket();
  private readonly flame = new Graphics();
  private readonly boom = new Graphics();
  private readonly readout: BitmapText;
  private clock = 0;
  private crashAt = 3;

  constructor() {
    super();
    const sky = new Graphics().rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(SCREEN_BG);
    // A faint striped retrowave sun setting behind the plot, like the game's chart.
    const sunX = SCREEN_WIDTH / 2;
    const sunR = 46;
    sky.circle(sunX, SCREEN_HEIGHT, sunR).fill({
      fill: vertical([
        [0, 0xffd23e],
        [0.45, 0xff5fa8],
        [1, 0x7b2ff7],
      ]),
      alpha: 0.3,
    });
    for (let i = 0; i < 5; i++) {
      sky
        .rect(sunX - sunR, SCREEN_HEIGHT - sunR * 0.55 + i * 6, sunR * 2, 1 + i * 0.8)
        .fill(SCREEN_BG);
    }
    for (let x = 20; x < SCREEN_WIDTH; x += 20) {
      sky.moveTo(x, 0).lineTo(x, SCREEN_HEIGHT);
    }
    for (let y = 10; y < SCREEN_HEIGHT; y += 20) {
      sky.moveTo(0, y).lineTo(SCREEN_WIDTH, y);
    }
    sky.stroke({ color: colors.cyan, width: 1, alpha: 0.14 });
    for (let i = 0; i < 14; i++) {
      sky
        .circle((i * 67) % SCREEN_WIDTH, (i * 41) % SCREEN_HEIGHT, i % 3 ? 0.8 : 1.4)
        .fill({ color: 0xffffff, alpha: 0.7 });
    }
    this.readout = new BitmapText({
      text: '',
      style: { fontFamily: displayFont, fontSize: 20, fontWeight: '700', fill: 0xffffff },
    });
    this.readout.anchor.set(0.5, 0);
    this.readout.position.set(SCREEN_WIDTH / 2, 8);
    this.rocket.addChildAt(this.flame, 0);
    this.addChild(sky, this.area, this.curve, this.rocket, this.boom, this.readout);
  }

  update(seconds: number): void {
    this.clock += seconds;
    if (this.clock > this.crashAt + 1) {
      this.clock = 0;
      this.crashAt = 2 + Math.random() * 2;
    }
    const t = Math.min(this.clock, this.crashAt);
    const crashed = this.clock > this.crashAt;
    const multiplier = Math.exp(0.5 * t);
    const color = crashed ? RED : tierColor(multiplier);
    // The longest run (4) ends at x = 128, leaving room for the rocket's nose and the burst.
    const at = (x: number) => ({ x: 10 + (x / 4) * 118, y: 120 - (Math.exp(0.5 * x) - 1) * 14 });
    const points: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const p = at((i / 24) * t);
      points.push(p.x, p.y);
    }
    this.area
      .clear()
      .poly([10, 120, ...points, points.at(-2)!, 120])
      .fill({ color, alpha: 0.12 });
    this.curve
      .clear()
      .poly(points, false)
      .stroke({ color, width: 7, alpha: 0.25 })
      .poly(points, false)
      .stroke({ color, width: 3, cap: 'round', join: 'round' });

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
          .fill({ color: i % 2 ? RED : colors.gold, alpha: 1 - b });
      }
    }
    this.readout.text = `${multiplier.toFixed(2)}×`;
    this.readout.tint = color;
  }
}

// --- Bonus Round -----------------------------------------------------------------------------

const LACQUER = 0x3b1a6b;
const LACQUER_LIGHT = 0x4f2590;
const BAND = 0xd9a520;
const AMETHYST = 0xb66dff;
const CHEST_W = 66;
const CHEST_Y = 112;
const HORIZON = 84;
const CYCLE = 3.6;
const OPEN_AT = 0.9;
const CLOSE_AT = 3.1;

/** The Royal Fortune stage: crowned Lucky hops while the chest bursts with coins. */
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
    // Dark royal sky and a neon grid floor running to the horizon.
    const stage = new Graphics().rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(
      vertical([
        [0, SCREEN_BG],
        [0.6, 0x1a0d33],
        [1, 0x120a24],
      ]),
    );
    stage
      .rect(0, HORIZON, SCREEN_WIDTH, SCREEN_HEIGHT - HORIZON)
      .fill({ color: 0x24104a, alpha: 0.7 });
    for (let i = -8; i <= 8; i++) {
      stage.moveTo(cx + i * 4, HORIZON).lineTo(cx + i * 22, SCREEN_HEIGHT);
    }
    for (let i = 1; i <= 5; i++) {
      const y = HORIZON + (i / 5) ** 2 * (SCREEN_HEIGHT - HORIZON);
      stage.moveTo(0, y).lineTo(SCREEN_WIDTH, y);
    }
    stage
      .stroke({ color: colors.neon, width: 1, alpha: 0.4 })
      .moveTo(0, HORIZON)
      .lineTo(SCREEN_WIDTH, HORIZON)
      .stroke({ color: PINK_LIGHT, width: 1.5, alpha: 0.8 });
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
        .fill({ color: colors.gold, alpha: 0.2 });
    }
    this.rays.position.set(cx, CHEST_Y - 34);
    const base = new Graphics()
      .ellipse(0, 1, CHEST_W / 2 + 6, 4)
      .fill({ color: colors.neon, alpha: 0.3 })
      .roundRect(-CHEST_W / 2, -36, CHEST_W, 36, 4)
      .fill(LACQUER)
      .stroke({ color: colors.gold, width: 2 })
      .rect(-CHEST_W / 2 + 6, -36, 6, 36)
      .fill(BAND)
      .rect(CHEST_W / 2 - 12, -36, 6, 36)
      .fill(BAND)
      .roundRect(-7, -31, 14, 16, 2)
      .fill(colors.gold)
      .poly([0, -29, 4, -23, 0, -17, -4, -23])
      .fill(AMETHYST);
    // The lid's bottom edge is y = 0 in lid space; open, it pops up and tips back.
    this.lid
      .roundRect(-CHEST_W / 2 - 2, -20, CHEST_W + 4, 20, 9)
      .fill(LACQUER_LIGHT)
      .stroke({ color: colors.gold, width: 2 })
      .rect(-CHEST_W / 2 + 5, -20, 6, 20)
      .fill(BAND)
      .rect(CHEST_W / 2 - 11, -20, 6, 20)
      .fill(BAND);
    this.lid.y = -36;
    const glow = new Graphics()
      .ellipse(0, -36, CHEST_W / 2 - 4, 6)
      .fill({ color: 0xfff1a8, alpha: 0.9 });
    this.chest.addChild(base, glow, this.lid);
    this.chest.position.set(cx, CHEST_Y);
    // Lucky: the bonus game's coin mascot, small, with pink shoes and the Royal Fortune crown.
    this.mascot
      .ellipse(-6, 17, 4.5, 2.5)
      .fill(colors.neon)
      .ellipse(6, 17, 4.5, 2.5)
      .fill(colors.neon)
      .rect(-7, 11, 3, 6)
      .fill(0xb8901a)
      .rect(4, 11, 3, 6)
      .fill(0xb8901a)
      .poly([-9, -12, -10, -22, -5, -17, 0, -24, 5, -17, 10, -22, 9, -12])
      .fill(colors.gold)
      .stroke({ color: 0xb8901a, width: 1, join: 'round' })
      .poly([0, -21, 2, -18, 0, -15, -2, -18])
      .fill(AMETHYST);
    coin(this.mascot, 0, 0, 14);
    this.mascot
      .circle(-5, -3, 2.2)
      .fill(0x2b1a0a)
      .circle(5, -3, 2.2)
      .fill(0x2b1a0a)
      .moveTo(-6, 4)
      .quadraticCurveTo(0, 10, 6, 4)
      .stroke({ color: 0x2b1a0a, width: 2, cap: 'round' });
    this.mascot.position.set(30, CHEST_Y - 18);
    this.addChild(stage, this.rays, this.coins, this.chest, this.mascot);
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
    this.mascot.y = CHEST_Y - 18 - Math.abs(Math.sin(this.clock * 5)) * (open ? 18 : 6);
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

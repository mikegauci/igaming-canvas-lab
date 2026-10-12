import { colors, fontFamily } from '@lab/core';
import { BitmapText, Container, Graphics } from 'pixi.js';

/** Size of a cabinet's screen, in cabinet space. */
export const SCREEN_WIDTH = 160;
export const SCREEN_HEIGHT = 130;

/**
 * A cabinet's attract mode: a tiny looping preview of its game. Each one is a few Graphics
 * redrawn or moved per frame, so five of them cost almost nothing.
 */
export interface Attract extends Container {
  update(seconds: number): void;
}

const SYMBOL_COLORS = [colors.neon, colors.gold, colors.cyan, 0x7cff6b, 0xff7a1a];

class SlotAttract extends Container implements Attract {
  private readonly reels: Graphics[] = [];
  private clock = 0;

  constructor() {
    super();
    for (let i = 0; i < 3; i++) {
      const reel = new Graphics();
      reel.x = 22 + i * 50;
      this.reels.push(reel);
      this.addChild(reel);
    }
  }

  update(seconds: number): void {
    this.clock = (this.clock + seconds) % 3;
    this.reels.forEach((reel, i) => {
      // Spin, then stop one reel after another, then hold on a "win".
      const stopAt = 1.1 + i * 0.3;
      const spinning = this.clock < stopAt;
      const offset = spinning ? (this.clock * 260) % 40 : 0;
      reel.clear();
      for (let row = -1; row < 4; row++) {
        const colorIndex = spinning ? (row + Math.floor(this.clock * 6.5) + i) % 5 : (row + 7) % 5;
        reel.circle(18, 22 + row * 40 + offset, 13).fill(SYMBOL_COLORS[(colorIndex + 5) % 5]!);
      }
    });
    const win = this.clock > 2 && Math.floor(this.clock * 8) % 2 === 0;
    this.reels[0]!.rect(-12, 60, 150, 4).fill({ color: colors.gold, alpha: win ? 1 : 0 });
  }
}

class WheelAttract extends Container implements Attract {
  private readonly wheel = new Graphics();
  private velocity = 9;
  private clock = 0;

  constructor() {
    super();
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      this.wheel
        .moveTo(0, 0)
        .arc(0, 0, 52, a0, a1)
        .closePath()
        .fill(SYMBOL_COLORS[i % 5]!);
    }
    this.wheel
      .circle(0, 0, 52)
      .stroke({ color: colors.gold, width: 4 })
      .circle(0, 0, 10)
      .fill(colors.gold);
    this.wheel.position.set(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 6);
    const pointer = new Graphics().poly([-8, 0, 8, 0, 0, 14]).fill(colors.text);
    pointer.position.set(SCREEN_WIDTH / 2, 4);
    this.addChild(this.wheel, pointer);
  }

  update(seconds: number): void {
    this.clock += seconds;
    // Spin up, coast down, pause, repeat.
    if (this.clock > 4) {
      this.clock = 0;
      this.velocity = 9;
    }
    this.velocity = this.clock < 3 ? this.velocity * Math.pow(0.45, seconds) : 0;
    this.wheel.rotation += this.velocity * seconds;
  }
}

class ScratchAttract extends Container implements Attract {
  private readonly foil = new Graphics();
  private clock = 0;

  constructor() {
    super();
    const coins = new Graphics();
    for (let i = 0; i < 9; i++) {
      coins
        .circle(32 + (i % 3) * 48, 22 + Math.floor(i / 3) * 42, 15)
        .fill(i % 4 === 0 ? colors.gold : colors.cyan);
    }
    this.addChild(coins, this.foil);
  }

  update(seconds: number): void {
    this.clock = (this.clock + seconds) % 3.2;
    // The foil is wiped away left to right, then comes back.
    const revealed = Math.min(1, this.clock / 2.2) * SCREEN_WIDTH;
    this.foil
      .clear()
      .rect(revealed, 0, SCREEN_WIDTH - revealed, SCREEN_HEIGHT)
      .fill(0xb9bec9);
    if (revealed < SCREEN_WIDTH) {
      this.foil.circle(revealed, 30 + Math.sin(this.clock * 9) * 30 + 35, 9).fill(colors.text);
    }
  }
}

class CrashAttract extends Container implements Attract {
  private readonly curve = new Graphics();
  private readonly readout: BitmapText;
  private clock = 0;
  private crashAt = 3;

  constructor() {
    super();
    this.readout = new BitmapText({
      text: '',
      style: { fontFamily, fontSize: 22, fontWeight: 'bold', fill: 0xffffff },
    });
    this.readout.anchor.set(0.5, 0);
    this.readout.position.set(SCREEN_WIDTH / 2, 8);
    this.addChild(this.curve, this.readout);
  }

  update(seconds: number): void {
    this.clock += seconds;
    if (this.clock > this.crashAt + 1) {
      this.clock = 0;
      this.crashAt = 2 + Math.random() * 2;
    }
    const t = Math.min(this.clock, this.crashAt);
    const crashed = this.clock > this.crashAt;
    const color = crashed ? 0xff3e5e : colors.gold;
    this.curve.clear();
    const points: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24) * t;
      points.push(10 + (x / 4) * 140, 120 - (Math.exp(0.5 * x) - 1) * 14);
    }
    this.curve.poly(points, false).stroke({ color, width: 4 });
    this.curve.circle(points.at(-2)!, points.at(-1)!, crashed ? 0 : 6).fill(colors.text);
    this.readout.text = `${Math.exp(0.5 * t).toFixed(2)}×`;
    this.readout.tint = color;
  }
}

class BonusAttract extends Container implements Attract {
  private readonly mascot = new Graphics();
  private readonly coins: Graphics;
  private clock = 0;

  constructor() {
    super();
    this.mascot
      .circle(0, 0, 30)
      .fill(colors.gold)
      .circle(-10, -6, 5)
      .fill(colors.bg)
      .circle(10, -6, 5)
      .fill(colors.bg)
      .moveTo(-12, 8)
      .quadraticCurveTo(0, 20, 12, 8)
      .stroke({ color: colors.bg, width: 3 });
    this.mascot.position.set(SCREEN_WIDTH / 2, 80);
    this.coins = new Graphics();
    this.addChild(this.coins, this.mascot);
  }

  update(seconds: number): void {
    this.clock += seconds;
    this.mascot.y = 82 - Math.abs(Math.sin(this.clock * 4)) * 16;
    this.coins.clear();
    for (let i = 0; i < 7; i++) {
      const y = ((this.clock * 70 + i * 37) % 150) - 10;
      const x = 12 + ((i * 53) % 140);
      this.coins.ellipse(x, y, 7 * Math.abs(Math.cos(this.clock * 5 + i)), 7).fill(colors.gold);
    }
  }
}

export function createAttract(game: 'slot' | 'wheel' | 'scratch' | 'crash' | 'bonus'): Attract {
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

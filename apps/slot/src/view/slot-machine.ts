import { colors, metalFill, verticalGradient } from '@lab/core';
import { gsap } from 'gsap';
import { Container, Graphics, type Texture, type Ticker } from 'pixi.js';
import { PAYLINES, REEL_STRIPS, ROWS, type SymbolId } from '../logic/config';
import type { LineWin } from '../logic/evaluate';
import { Reel } from './reel';

export const CELL_WIDTH = 158;
export const CELL_HEIGHT = 126;
const REEL_GAP = 10;
const PADDING = 24;
/** Reels keep spinning at least this long, even if the server answers instantly. */
const MIN_SPIN_SECONDS = 0.7;
/** Delay between one reel stopping and the next. */
const STOP_STAGGER_SECONDS = 0.28;

export const LINE_COLORS = [colors.gold, colors.neon, colors.cyan, 0x7cff6b, 0xff9f3e];

const WINDOW_WIDTH = CELL_WIDTH * REEL_STRIPS.length + REEL_GAP * (REEL_STRIPS.length - 1);
const WINDOW_HEIGHT = CELL_HEIGHT * ROWS;

/** Reels, frame, mask and payline overlay. Knows nothing about bets or wallets. */
export class SlotMachine extends Container {
  static readonly WIDTH = WINDOW_WIDTH + PADDING * 2;
  static readonly HEIGHT = WINDOW_HEIGHT + PADDING * 2;

  /** Called as each reel lands, e.g. to play a stop sound. */
  onReelStop?: (reel: number) => void;

  private readonly reels: Reel[];
  private readonly lines = new Graphics();
  private spinStartedAt = 0;
  private slammed = false;
  private wake: (() => void) | null = null;
  private pulsing: Container[] = [];

  constructor(textures: Record<SymbolId, Texture>, initialStops: readonly number[]) {
    super();

    const w = SlotMachine.WIDTH;
    const h = SlotMachine.HEIGHT;
    const frame = new Graphics()
      .roundRect(-8, -8, w + 16, h + 16, 25)
      .fill(0x060612)
      .roundRect(0, 0, w, h, 20)
      .fill(metalFill())
      .stroke({ color: 0xd2e0f4, width: 1.5 })
      .roundRect(7, 7, w - 14, h - 14, 15)
      .fill(0x141022)
      .stroke({ color: colors.neon, width: 3 })
      .roundRect(11, 11, w - 22, h - 22, 12)
      .stroke({ color: 0xffb9e6, width: 1, alpha: 0.7 })
      .roundRect(PADDING - 3, PADDING - 3, WINDOW_WIDTH + 6, WINDOW_HEIGHT + 6, 8)
      .fill(0x040712)
      .stroke({ color: 0x5edfff, width: 1, alpha: 0.55 });
    const glow = new Graphics()
      .roundRect(-4, -4, w + 8, h + 8, 23)
      .stroke({ color: colors.neon, width: 16, alpha: 0.12 });

    const reelWindow = new Container();
    reelWindow.position.set(PADDING, PADDING);
    const columns = new Graphics();
    const mask = new Graphics().rect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT).fill(0xffffff);

    this.reels = REEL_STRIPS.map((strip, i) => {
      const x = i * (CELL_WIDTH + REEL_GAP);
      columns
        .roundRect(x, 0, CELL_WIDTH, WINDOW_HEIGHT, 6)
        .fill(
          verticalGradient([
            [0, '#27304c'],
            [0.12, '#c0ccdf'],
            [0.4, '#f5f7ff'],
            [0.65, '#d3dbec'],
            [1, '#313552'],
          ]),
        )
        .stroke({ color: 0x93add0, width: 1 });
      const reel = new Reel({
        strip,
        textures,
        cellWidth: CELL_WIDTH,
        cellHeight: CELL_HEIGHT,
        rows: ROWS,
        stop: initialStops[i],
      });
      reel.x = x;
      return reel;
    });

    // One rectangular mask over all reels clips the off-screen symbols.
    const reelLayer = new Container();
    reelLayer.addChild(...this.reels);
    reelLayer.mask = mask;

    // Soft shading at the top and bottom of the window sells the curved-drum look.
    const shade = new Graphics();
    for (let i = 0; i < 6; i++) {
      const h = 10;
      shade.rect(0, i * h, WINDOW_WIDTH, h).fill({ color: 0x000000, alpha: 0.32 - i * 0.05 });
      shade
        .rect(0, WINDOW_HEIGHT - (i + 1) * h, WINDOW_WIDTH, h)
        .fill({ color: 0x000000, alpha: 0.32 - i * 0.05 });
    }

    const chrome = new Graphics();
    for (const x of [12, w - 12]) {
      for (const y of [12, h - 12]) {
        chrome
          .circle(x, y, 3)
          .fill(0xc3cce1)
          .moveTo(x - 2, y)
          .lineTo(x + 2, y)
          .stroke({ color: 0x454966, width: 1 });
      }
    }
    for (let row = 0; row < ROWS; row++) {
      const y = PADDING + (row + 0.5) * CELL_HEIGHT;
      chrome.poly([8, y - 5, 16, y, 8, y + 5]).fill(colors.cyan);
      chrome.poly([w - 8, y - 5, w - 16, y, w - 8, y + 5]).fill(colors.cyan);
    }
    reelWindow.addChild(columns, reelLayer, mask, shade, this.lines);
    this.addChild(glow, frame, reelWindow, chrome);
  }

  update(ticker: Ticker): void {
    const seconds = ticker.deltaMS / 1000;
    for (const reel of this.reels) reel.update(seconds);
  }

  spin(): void {
    this.clearWins();
    this.slammed = false;
    this.spinStartedAt = performance.now();
    this.reels.forEach((reel, i) => reel.start(i * 0.08));
  }

  /** Lands the reels on `stops`, one after another (all at once after a slam). */
  async stop(stops: readonly number[]): Promise<void> {
    const elapsed = (performance.now() - this.spinStartedAt) / 1000;
    if (elapsed < MIN_SPIN_SECONDS) await this.wait(MIN_SPIN_SECONDS - elapsed);

    const landed: Promise<void>[] = [];
    for (const [i, reel] of this.reels.entries()) {
      if (i > 0) await this.wait(STOP_STAGGER_SECONDS);
      landed.push(reel.stop(stops[i]!, this.slammed).then(() => this.onReelStop?.(i)));
    }
    await Promise.all(landed);
  }

  /** Player asked to stop early: skip remaining waits and hurry reels already landing. */
  slam(): void {
    this.slammed = true;
    this.wake?.();
    for (const reel of this.reels) reel.hurry();
  }

  showWins(wins: readonly LineWin[]): void {
    this.clearWins();
    const xs = this.reels.map((reel) => reel.x + CELL_WIDTH / 2);
    const yOf = (row: number) => (row + 0.5) * CELL_HEIGHT;

    for (const win of wins) {
      const rows = PAYLINES[win.line]!;
      const color = LINE_COLORS[win.line % LINE_COLORS.length]!;
      const points = rows.map((row, reel) => [xs[reel]!, yOf(row)] as const);
      for (const [width, alpha] of [
        [14, 0.25],
        [5, 1],
      ] as const) {
        this.lines.moveTo(points[0]![0] - CELL_WIDTH / 2, points[0]![1]);
        for (const [x, y] of points) this.lines.lineTo(x, y);
        this.lines.lineTo(points.at(-1)![0] + CELL_WIDTH / 2, points.at(-1)![1]);
        this.lines.stroke({ color, width, alpha, cap: 'round', join: 'round' });
      }
      rows.forEach((row, reel) => this.pulsing.push(this.reels[reel]!.symbolAt(row)));
    }

    this.lines.alpha = 0;
    gsap.to(this.lines, { alpha: 1, duration: 0.2 });
    const symbols = [...new Set(this.pulsing)];
    gsap.to(
      symbols.map((s) => s.scale),
      { x: 1.12, y: 1.12, duration: 0.35, ease: 'sine.inOut', yoyo: true, repeat: -1 },
    );
  }

  clearWins(): void {
    gsap.killTweensOf(this.lines);
    this.lines.clear();
    for (const symbol of this.pulsing) {
      gsap.killTweensOf(symbol.scale);
      symbol.scale.set(1);
    }
    this.pulsing = [];
  }

  /** gsap-timed delay that `slam()` can cut short. */
  private wait(seconds: number): Promise<void> {
    if (this.slammed) return Promise.resolve();
    return new Promise((resolve) => {
      const call = gsap.delayedCall(seconds, done);
      function done() {
        call.kill();
        resolve();
      }
      this.wake = done;
    });
  }
}

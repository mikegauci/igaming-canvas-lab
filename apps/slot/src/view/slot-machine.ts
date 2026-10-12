import { colors } from '@lab/core';
import { gsap } from 'gsap';
import { Container, Graphics, type Texture, type Ticker } from 'pixi.js';
import { PAYLINES, REEL_STRIPS, ROWS, type SymbolId } from '../logic/config';
import type { LineWin } from '../logic/evaluate';
import { Reel } from './reel';

export const CELL_WIDTH = 170;
export const CELL_HEIGHT = 150;
const REEL_GAP = 10;
const PADDING = 18;
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

    const frame = new Graphics()
      .roundRect(0, 0, SlotMachine.WIDTH, SlotMachine.HEIGHT, 24)
      .fill(colors.panel)
      .stroke({ color: colors.neon, width: 4, alpha: 0.85 });
    const glow = new Graphics()
      .roundRect(-6, -6, SlotMachine.WIDTH + 12, SlotMachine.HEIGHT + 12, 30)
      .stroke({ color: colors.neon, width: 10, alpha: 0.18 });

    const reelWindow = new Container();
    reelWindow.position.set(PADDING, PADDING);
    const columns = new Graphics();
    const mask = new Graphics().rect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT).fill(0xffffff);

    this.reels = REEL_STRIPS.map((strip, i) => {
      const x = i * (CELL_WIDTH + REEL_GAP);
      columns.roundRect(x, 0, CELL_WIDTH, WINDOW_HEIGHT, 10).fill(0x0f0f1f);
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

    reelWindow.addChild(columns, reelLayer, mask, shade, this.lines);
    this.addChild(glow, frame, reelWindow);
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

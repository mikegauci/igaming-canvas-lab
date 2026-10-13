import { arcadeFont, chromeFill, colors, metalFill, verticalGradient } from '@lab/core';
import { gsap } from 'gsap';
import {
  Container,
  Graphics,
  Point,
  Rectangle,
  RenderTexture,
  Sprite,
  Text,
  type FederatedPointerEvent,
  type Renderer,
  type Texture,
} from 'pixi.js';
import { CELLS, SYMBOLS, type CardSymbol } from '../logic/card';
import { CoverageGrid, type Rect } from '../logic/coverage';

export const AREA = 480;
const CELL = 150;
const GAP = 15;
const PADDING = 30;
const HEADER = 74;
export const CARD_WIDTH = AREA + PADDING * 2;
export const CARD_HEIGHT = HEADER + AREA + PADDING;
const BRUSH_RADIUS = 26;

/** Look of each prize coin: low prizes are bronze/silver, the 100× jackpot is a neon star. */
export const SYMBOL_STYLE: Record<CardSymbol, { coin: number; rim: number; text: number }> = {
  1: { coin: 0xcd8a4a, rim: 0x8a5a2b, text: 0x2b1a0a },
  2: { coin: 0xd5d9e0, rim: 0x8c929c, text: 0x23262c },
  5: { coin: colors.gold, rim: 0xb8901a, text: 0x2b2108 },
  10: { coin: colors.cyan, rim: 0x1fa3b3, text: 0x05272b },
  20: { coin: colors.neon, rim: 0xa8216b, text: 0xffffff },
  100: { coin: 0x7b2ff7, rim: colors.gold, text: colors.gold },
};

export const cellRect = (index: number): Rect => ({
  x: (index % 3) * (CELL + GAP),
  y: Math.floor(index / 3) * (CELL + GAP),
  width: CELL,
  height: CELL,
});

function drawCoin(symbol: CardSymbol, radius: number): Container {
  const style = SYMBOL_STYLE[symbol];
  const coin = new Graphics()
    .circle(0, 0, radius)
    .fill(style.coin)
    .stroke({ color: style.rim, width: radius * 0.12 })
    .circle(0, 0, radius * 0.78)
    .stroke({ color: style.rim, width: radius * 0.04, alpha: 0.6 })
    .ellipse(-radius * 0.18, -radius * 0.5, radius * 0.48, radius * 0.17)
    .fill({ color: 0xffffff, alpha: 0.28 });
  if (symbol === 100)
    coin.star(0, 0, 5, radius * 0.95, radius * 0.6).fill({ color: colors.gold, alpha: 0.25 });
  const label = new Text({
    text: `×${symbol}`,
    style: {
      fontFamily: arcadeFont,
      fontSize: radius * (symbol >= 100 ? 0.44 : 0.54),
      fontWeight: '900',
      fill: style.text,
    },
  });
  label.anchor.set(0.5);
  return new Container({ children: [coin, label] });
}

/** Bakes a vector drawing into a texture; the wrapper makes the art's own position count. */
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

/** Small coin sprite for the odds table, sharing the card's look. */
export function coinIcon(symbol: CardSymbol): Container {
  return drawCoin(symbol, 11);
}

function drawFoil(): Container {
  const foil = new Container();
  // Holographic silver: a cool chrome sweep with faint cyan and pink sheen bands.
  const g = new Graphics().roundRect(0, 0, AREA, AREA, 14).fill(
    verticalGradient([
      [0, '#dfe6f5'],
      [0.35, '#aab3c9'],
      [0.55, '#c9c3e0'],
      [1, '#9aa3bb'],
    ]),
  );
  for (let i = -AREA, n = 0; i < AREA * 2; i += 36, n++) {
    g.moveTo(i, 0)
      .lineTo(i + AREA * 0.6, AREA)
      .stroke({
        color: n % 3 === 0 ? 0xa1f8ff : n % 3 === 1 ? 0xff8bd0 : 0xffffff,
        width: 10,
        alpha: 0.2,
      });
  }
  // Faint outlines hint where the nine prizes are, like a printed card.
  for (let i = 0; i < CELLS; i++) {
    const { x, y } = cellRect(i);
    g.roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 12).stroke({
      color: 0x6f7591,
      width: 2,
      alpha: 0.55,
    });
  }
  foil.addChild(g);
  for (let i = 0; i < CELLS; i++) {
    const { x, y } = cellRect(i);
    const label = new Text({
      text: 'SCRATCH',
      style: {
        fontFamily: arcadeFont,
        fontSize: 18,
        fontWeight: '900',
        fill: 0x6f7591,
        letterSpacing: 2,
      },
    });
    label.anchor.set(0.5);
    label.position.set(x + CELL / 2, y + CELL / 2);
    label.rotation = -0.3;
    foil.addChild(label);
  }
  return foil;
}

/**
 * The card. Prizes sit above a silver foil and are masked by a RenderTexture: scratching paints
 * brush strokes into that texture, revealing the prizes underneath. The same strokes are stamped
 * into a CoverageGrid so the game knows how much has been uncovered without reading pixels back.
 */
export class ScratchCard extends Container {
  /** Called after each brush stroke with the newly covered grid cells and the point in card space. */
  onScratch?: (added: number, at: Point) => void;

  readonly grid = new CoverageGrid(AREA, AREA, 48, 48);
  private readonly renderer: Renderer;
  private readonly area = new Container();
  private readonly prizes = new Container();
  private readonly tiles: Sprite[];
  private readonly glows: Graphics[];
  private readonly symbolTextures: Record<CardSymbol, Texture>;
  private readonly foilTexture: Texture;
  private readonly revealTexture: RenderTexture;
  private readonly brush = new Graphics();
  private readonly emptyStage = new Container();
  private last: Point | null = null;
  /** The one pointer allowed to scratch; other fingers are ignored until it lifts. */
  private pointerId: number | null = null;
  private wipe: gsap.core.Tween | null = null;
  private _enabled = false;

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;

    // Metal cabinet frame around a neon-edged card, like the wheel's rim.
    const frame = new Graphics()
      .roundRect(-12, -8, CARD_WIDTH + 24, CARD_HEIGHT + 24, 32)
      .fill({ color: 0x050611, alpha: 0.85 })
      .roundRect(-10, -10, CARD_WIDTH + 20, CARD_HEIGHT + 20, 32)
      .fill(metalFill())
      .stroke({ color: 0xabb7d4, width: 2 })
      .roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 24)
      .fill(0x101126)
      .stroke({ color: colors.neon, width: 3, alpha: 0.9 })
      .roundRect(4, 4, CARD_WIDTH - 8, CARD_HEIGHT - 8, 21)
      .stroke({ color: colors.neon, width: 9, alpha: 0.13 });
    for (const x of [18, CARD_WIDTH - 18]) {
      frame
        .circle(x, HEADER / 2 + 4, 4)
        .fill(x < CARD_WIDTH / 2 ? 0xa1f8ff : 0xff8bd0)
        .circle(x, HEADER / 2 + 4, 8)
        .fill({ color: x < CARD_WIDTH / 2 ? 0xa1f8ff : 0xff8bd0, alpha: 0.18 });
    }
    const heading = new Text({
      text: 'MATCH 3 TO WIN',
      style: {
        fontFamily: arcadeFont,
        fontSize: 30,
        fontWeight: '900',
        fontStyle: 'italic',
        fill: chromeFill(),
        stroke: { color: 0x09091a, width: 4, join: 'round' },
        letterSpacing: 2,
        padding: 12,
      },
    });
    heading.anchor.set(0.5);
    heading.position.set(CARD_WIDTH / 2, HEADER / 2 + 6);

    this.symbolTextures = Object.fromEntries(
      SYMBOLS.map((symbol) => {
        const art = drawCoin(symbol, 52);
        art.position.set(CELL / 2, CELL / 2);
        return [symbol, bake(renderer, art, new Rectangle(0, 0, CELL, CELL))];
      }),
    ) as Record<CardSymbol, Texture>;

    this.foilTexture = bake(renderer, drawFoil(), new Rectangle(0, 0, AREA, AREA));
    const foil = new Sprite(this.foilTexture);
    // Under the foil: a dark enamel tray with a lit window per prize.
    const paper = new Graphics().roundRect(0, 0, AREA, AREA, 14).fill(0x0b0c1d);
    for (let i = 0; i < CELLS; i++) {
      const { x, y } = cellRect(i);
      paper
        .roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 14)
        .fill(i % 2 ? 0x1b1934 : 0x161830)
        .stroke({ color: colors.cyan, width: 1.5, alpha: 0.35 });
    }
    this.glows = Array.from({ length: CELLS }, (_, i) => {
      const { x, y } = cellRect(i);
      const glow = new Graphics()
        .roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 16)
        .fill({ color: colors.gold, alpha: 0.35 })
        .stroke({ color: colors.neon, width: 5 });
      glow.alpha = 0;
      return glow;
    });
    this.tiles = Array.from({ length: CELLS }, (_, i) => {
      const tile = new Sprite(this.symbolTextures[1]);
      const { x, y } = cellRect(i);
      tile.anchor.set(0.5);
      tile.position.set(x + CELL / 2, y + CELL / 2);
      return tile;
    });
    this.prizes.addChild(paper, ...this.glows, ...this.tiles);

    this.revealTexture = RenderTexture.create({ width: AREA, height: AREA });
    const mask = new Sprite(this.revealTexture);
    this.prizes.mask = mask;
    this.cover();

    this.area.position.set(PADDING, HEADER);
    this.area.addChild(foil, this.prizes, mask);
    this.area.hitArea = new Rectangle(0, 0, AREA, AREA);
    this.area.on('pointerdown', (e) => this.startStroke(e));
    this.area.on('globalpointermove', (e) => this.continueStroke(e));
    this.area.on('pointerup', (e) => this.endStroke(e.pointerId));
    this.area.on('pointerupoutside', (e) => this.endStroke(e.pointerId));
    this.area.on('pointercancel', (e) => this.endStroke(e.pointerId));

    this.addChild(frame, heading, this.area);
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /** Whether the player can scratch. */
  set enabled(value: boolean) {
    this._enabled = value;
    this.area.eventMode = value ? 'static' : 'none';
    this.area.cursor = value ? 'pointer' : 'default';
    if (!value) this.endStroke(this.pointerId);
  }

  /** Covers the card again and puts these symbols under the foil. */
  deal(cells: readonly CardSymbol[]): void {
    this.clearHighlight();
    cells.forEach((symbol, i) => (this.tiles[i]!.texture = this.symbolTextures[symbol]));
    this.cover();
    this.grid.reset();
  }

  /** Share of one prize cell that has been scratched, 0..1. */
  cellCoverage(index: number): number {
    return this.grid.coverageIn(cellRect(index));
  }

  /** Wipes the rest of the foil away with an expanding circle. Resolves when done. */
  revealAll(duration = 0.5): Promise<void> {
    this.enabled = false;
    const wipe = { radius: 0 };
    const center = AREA / 2;
    return new Promise((resolve) => {
      this.wipe = gsap.to(wipe, {
        radius: AREA * 0.75,
        duration,
        ease: 'power2.in',
        onUpdate: () => this.paint(center, center, center, center, wipe.radius),
        onComplete: () => {
          this.wipe = null;
          this.grid.stamp(center, center, center, center, AREA);
          resolve();
        },
        // Killed by destroy(): stop painting, but don't leave the caller waiting.
        onInterrupt: () => resolve(),
      });
    });
  }

  highlight(cells: readonly number[]): void {
    for (const i of cells) {
      gsap.to(this.glows[i]!, {
        alpha: 1,
        duration: 0.35,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
      gsap.fromTo(
        this.tiles[i]!.scale,
        { x: 1, y: 1 },
        { x: 1.1, y: 1.1, duration: 0.35, yoyo: true, repeat: -1 },
      );
    }
  }

  clearHighlight(): void {
    for (let i = 0; i < CELLS; i++) {
      gsap.killTweensOf([this.glows[i]!, this.tiles[i]!.scale]);
      this.glows[i]!.alpha = 0;
      this.tiles[i]!.scale.set(1);
    }
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    this.wipe?.kill();
    this.clearHighlight();
    super.destroy(...args);
    // Textures baked or rendered here are owned here; display-object destroy doesn't free them.
    this.revealTexture.destroy(true);
    this.foilTexture.destroy(true);
    Object.values(this.symbolTextures).forEach((texture) => texture.destroy(true));
    this.brush.destroy();
  }

  private startStroke(event: FederatedPointerEvent) {
    if (!this._enabled || this.pointerId !== null) return;
    this.pointerId = event.pointerId;
    const point = this.area.toLocal(event.global);
    this.last = point;
    this.scratch(point, point);
  }

  private continueStroke(event: FederatedPointerEvent) {
    if (!this._enabled || !this.last || event.pointerId !== this.pointerId) return;
    // Released outside the window, where no pointerup reaches us: stop instead of scratching
    // on hover when the mouse comes back.
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      this.endStroke(event.pointerId);
      return;
    }
    const point = this.area.toLocal(event.global);
    this.scratch(this.last, point);
    this.last = point;
  }

  private endStroke(pointerId: number | null) {
    if (pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.last = null;
  }

  private scratch(from: Point, to: Point) {
    this.paint(from.x, from.y, to.x, to.y, BRUSH_RADIUS);
    const added = this.grid.stamp(from.x, from.y, to.x, to.y, BRUSH_RADIUS);
    this.onScratch?.(added, new Point(to.x + this.area.x, to.y + this.area.y));
  }

  /** Clears the reveal texture to fully transparent, i.e. all foil. */
  private cover() {
    // Transparent, not the renderer's (opaque) background colour: the mask reads alpha.
    this.renderer.render({
      container: this.emptyStage,
      target: this.revealTexture,
      clear: true,
      clearColor: [0, 0, 0, 0],
    });
  }

  /** Paints a round-capped stroke into the reveal texture (a dot when both ends match). */
  private paint(x0: number, y0: number, x1: number, y1: number, radius: number) {
    this.brush.clear();
    if (x0 === x1 && y0 === y1) this.brush.circle(x0, y0, radius).fill(0xffffff);
    else
      this.brush
        .moveTo(x0, y0)
        .lineTo(x1, y1)
        .stroke({ color: 0xffffff, width: radius * 2, cap: 'round' });
    this.renderer.render({ container: this.brush, target: this.revealTexture, clear: false });
  }
}

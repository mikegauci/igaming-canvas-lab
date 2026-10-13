import { arcadeFont, verticalGradient } from '@lab/core';
import { Container, Graphics, Rectangle, Text, type Renderer, type Texture } from 'pixi.js';
import { SYMBOLS, type SymbolId } from '../logic/config';

/** Symbols are drawn once, then baked; spinning only moves batched sprites. */
const SIZE = 150;
const outline = { color: 0x17162c, width: 3, join: 'round' as const };
const gold = () =>
  verticalGradient([
    [0, '#fff9b4'],
    [0.3, '#ffdb55'],
    [0.6, '#efa724'],
    [1, '#a45316'],
  ]);

function sparkle(g: Graphics, x: number, y: number, size = 7): void {
  g.poly([
    x,
    y - size,
    x + 2,
    y - 2,
    x + size,
    y,
    x + 2,
    y + 2,
    x,
    y + size,
    x - 2,
    y + 2,
    x - size,
    y,
    x - 2,
    y - 2,
  ]).fill(0xffffff);
}

const draw: Record<SymbolId, () => Container> = {
  cherry: () => {
    const g = new Graphics();
    g.ellipse(77, 131, 45, 5).fill({ color: 0x16162d, alpha: 0.18 });
    for (const [x, y] of [
      [54, 93],
      [98, 96],
    ]) {
      g.moveTo(x!, y!)
        .bezierCurveTo(x!, 64, 82, 51, 84, 30)
        .stroke({ color: 0x173e35, width: 8, cap: 'round' })
        .moveTo(x! - 1, y!)
        .bezierCurveTo(x! - 1, 64, 82, 51, 84, 30)
        .stroke({ color: 0x55dc87, width: 3, cap: 'round' });
    }
    g.moveTo(83, 33)
      .bezierCurveTo(96, 13, 120, 20, 126, 30)
      .bezierCurveTo(108, 49, 92, 44, 83, 33)
      .fill(0x29b96c)
      .stroke(outline)
      .moveTo(86, 33)
      .lineTo(117, 29)
      .stroke({ color: 0x91ffb3, width: 2 });
    g.circle(53, 104, 25)
      .fill(
        verticalGradient([
          [0, '#ff779a'],
          [0.3, '#ed205b'],
          [1, '#790c35'],
        ]),
      )
      .stroke(outline)
      .circle(98, 108, 25)
      .fill(
        verticalGradient([
          [0, '#ff97b3'],
          [0.3, '#ff306a'],
          [1, '#a70d42'],
        ]),
      )
      .stroke(outline)
      .ellipse(44, 94, 8, 5)
      .fill({ color: 0xffffff, alpha: 0.75 })
      .ellipse(88, 98, 8, 5)
      .fill({ color: 0xffffff, alpha: 0.75 });
    sparkle(g, 110, 117, 4);
    return g;
  },
  lemon: () => {
    const g = new Graphics();
    g.ellipse(75, 119, 44, 5).fill({ color: 0x16162d, alpha: 0.18 });
    g.moveTo(24, 76)
      .bezierCurveTo(35, 76, 32, 41, 74, 39)
      .bezierCurveTo(111, 37, 118, 71, 127, 76)
      .bezierCurveTo(118, 84, 115, 111, 75, 115)
      .bezierCurveTo(37, 113, 36, 86, 24, 76)
      .fill(gold())
      .stroke(outline);
    g.ellipse(62, 57, 21, 9)
      .fill({ color: 0xfffddd, alpha: 0.85 })
      .moveTo(45, 99)
      .bezierCurveTo(70, 116, 102, 96, 110, 84)
      .stroke({ color: 0xffef79, width: 3, alpha: 0.7, cap: 'round' });
    sparkle(g, 101, 56, 5);
    return g;
  },
  bell: () => {
    const g = new Graphics();
    g.ellipse(75, 130, 45, 5).fill({ color: 0x16162d, alpha: 0.18 });
    g.circle(75, 29, 8)
      .fill(gold())
      .stroke(outline)
      .circle(75, 117, 10)
      .fill(gold())
      .stroke(outline)
      .moveTo(38, 103)
      .bezierCurveTo(40, 58, 51, 36, 75, 35)
      .bezierCurveTo(98, 36, 110, 58, 112, 103)
      .lineTo(124, 114)
      .lineTo(26, 114)
      .closePath()
      .fill(gold())
      .stroke(outline)
      .roundRect(50, 52, 11, 43, 5)
      .fill({ color: 0xfffddd, alpha: 0.8 })
      .moveTo(31, 108)
      .lineTo(119, 108)
      .stroke({ color: 0xffeb88, width: 3 })
      .moveTo(96, 52)
      .bezierCurveTo(103, 68, 106, 91, 105, 99)
      .stroke({ color: 0xad6519, width: 5, alpha: 0.6, cap: 'round' });
    sparkle(g, 82, 47, 5);
    return g;
  },
  bar: () => {
    const c = new Container();
    const g = new Graphics()
      .roundRect(14, 48, 122, 62, 10)
      .fill(0x101224)
      .stroke(outline)
      .roundRect(14, 43, 122, 62, 10)
      .fill(gold())
      .stroke(outline)
      .roundRect(20, 49, 110, 50, 6)
      .fill(
        verticalGradient([
          [0, '#525471'],
          [0.4, '#1d203b'],
          [1, '#080b1c'],
        ]),
      )
      .stroke({ color: 0xffef9c, width: 1 });
    const label = new Text({
      text: 'BAR',
      style: {
        fontFamily: arcadeFont,
        fontSize: 32,
        fontWeight: '900',
        fill: gold(),
        letterSpacing: 2,
        stroke: { color: 0x08091a, width: 2 },
        dropShadow: { color: 0x000000, blur: 2, distance: 2, alpha: 0.6 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(75, 75);
    sparkle(g, 125, 48, 6);
    c.addChild(g, label);
    return c;
  },
  seven: () => {
    const c = new Container();
    const label = new Text({
      text: '7',
      style: {
        fontFamily: arcadeFont,
        fontStyle: 'italic',
        fontSize: 96,
        fontWeight: '900',
        fill: verticalGradient([
          [0, '#ffb2dd'],
          [0.22, '#ff398b'],
          [0.55, '#e70850'],
          [1, '#890a4c'],
        ]),
        stroke: { color: 0xf0f5ff, width: 7, join: 'round' },
        dropShadow: { color: 0x16152a, alpha: 1, distance: 3, blur: 1, angle: Math.PI / 2 },
        padding: 6,
      },
    });
    label.anchor.set(0.5);
    label.position.set(71, 77);
    const g = new Graphics();
    sparkle(g, 108, 42, 7);
    c.addChild(label, g);
    return c;
  },
  diamond: () => {
    const g = new Graphics();
    g.ellipse(75, 131, 35, 5).fill({ color: 0x16162d, alpha: 0.18 });
    g.poly([43, 36, 107, 36, 132, 65, 75, 126, 18, 65])
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
      .stroke({ color: 0xf0ffff, width: 2, alpha: 0.85 });
    sparkle(g, 44, 42, 8);
    return g;
  },
};

export function createSymbolTextures(renderer: Renderer): Record<SymbolId, Texture> {
  const frame = new Rectangle(0, 0, SIZE, SIZE);
  const entries = SYMBOLS.map((id) => {
    const art = new Container({ children: [draw[id]()] });
    const texture = renderer.generateTexture({
      target: art,
      frame,
      resolution: renderer.resolution,
      antialias: true,
    });
    art.destroy({ children: true });
    return [id, texture] as const;
  });
  return Object.fromEntries(entries) as Record<SymbolId, Texture>;
}

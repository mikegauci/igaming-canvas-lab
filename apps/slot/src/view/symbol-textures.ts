import { fontFamily } from '@lab/core';
import { Container, Graphics, Rectangle, Text, type Renderer, type Texture } from 'pixi.js';
import { SYMBOLS, type SymbolId } from '../logic/config';

/** Artwork is drawn on a 150×150 canvas, then baked into textures. */
const SIZE = 150;

const draw: Record<SymbolId, () => Container> = {
  cherry: () => {
    const g = new Graphics();
    g.moveTo(58, 90)
      .bezierCurveTo(60, 60, 70, 40, 84, 30)
      .stroke({ color: 0x2fae5f, width: 6, cap: 'round' });
    g.moveTo(98, 92)
      .bezierCurveTo(96, 65, 90, 45, 84, 30)
      .stroke({ color: 0x2fae5f, width: 6, cap: 'round' });
    g.ellipse(100, 32, 20, 10).fill(0x3ddc84);
    g.circle(55, 104, 25).fill(0xc8102e).circle(98, 108, 25).fill(0xe8264b);
    g.circle(46, 95, 7).fill({ color: 0xffffff, alpha: 0.55 });
    g.circle(89, 99, 7).fill({ color: 0xffffff, alpha: 0.55 });
    return g;
  },
  lemon: () => {
    const g = new Graphics();
    g.circle(28, 78, 9).fill(0xf5c518).circle(122, 78, 9).fill(0xf5c518);
    g.ellipse(75, 78, 50, 38).fill(0xffe14d).stroke({ color: 0xf5c518, width: 4 });
    g.ellipse(58, 64, 16, 8).fill({ color: 0xffffff, alpha: 0.5 });
    return g;
  },
  bell: () => {
    const g = new Graphics();
    g.circle(75, 30, 9).fill(0xd99a1e);
    g.circle(75, 116, 11).fill(0xd99a1e);
    g.moveTo(38, 104)
      .bezierCurveTo(40, 58, 52, 36, 75, 34)
      .bezierCurveTo(98, 36, 110, 58, 112, 104)
      .lineTo(124, 114)
      .lineTo(26, 114)
      .closePath()
      .fill(0xffc23e)
      .stroke({ color: 0xd99a1e, width: 4, join: 'round' });
    g.roundRect(56, 50, 10, 42, 5).fill({ color: 0xffffff, alpha: 0.45 });
    return g;
  },
  bar: () => {
    const c = new Container();
    const g = new Graphics()
      .roundRect(14, 46, 122, 58, 12)
      .fill(0x1a1a2e)
      .stroke({ color: 0xffd23e, width: 5 });
    const label = new Text({
      text: 'BAR',
      style: { fontFamily, fontSize: 40, fontWeight: '900', fill: 0xffd23e, letterSpacing: 4 },
    });
    label.anchor.set(0.5);
    label.position.set(77, 76);
    c.addChild(g, label);
    return c;
  },
  seven: () => {
    const label = new Text({
      text: '7',
      style: {
        fontFamily,
        fontSize: 132,
        fontWeight: '900',
        fill: 0xff3e5e,
        stroke: { color: 0xffd23e, width: 8, join: 'round' },
        dropShadow: { color: 0x000000, alpha: 0.4, distance: 4, blur: 2, angle: Math.PI / 2 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(75, 78);
    return label;
  },
  diamond: () => {
    const g = new Graphics();
    g.poly([44, 40, 106, 40, 132, 66, 75, 132, 18, 66]).fill(0x3ef0ff);
    g.poly([44, 40, 106, 40, 92, 66, 58, 66]).fill({ color: 0xffffff, alpha: 0.35 });
    g.moveTo(18, 66).lineTo(132, 66);
    g.moveTo(58, 66).lineTo(75, 132).lineTo(92, 66);
    g.moveTo(44, 40).lineTo(58, 66);
    g.moveTo(106, 40).lineTo(92, 66);
    g.stroke({ color: 0xffffff, alpha: 0.6, width: 2 });
    g.poly([44, 40, 106, 40, 132, 66, 75, 132, 18, 66]).stroke({ color: 0x1fb8c9, width: 3 });
    return g;
  },
};

/**
 * Draws each symbol once and bakes it into a texture. Reels then use plain Sprites, which batch
 * into a single draw call instead of re-tessellating vector Graphics every spin.
 */
export function createSymbolTextures(renderer: Renderer): Record<SymbolId, Texture> {
  const frame = new Rectangle(0, 0, SIZE, SIZE);
  const entries = SYMBOLS.map((id) => {
    // generateTexture ignores the target's own transform, so wrap the art: any position set
    // on it inside draw() then still counts.
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

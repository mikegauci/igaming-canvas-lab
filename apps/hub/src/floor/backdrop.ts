import { colors } from '@lab/core';
import { Container, Graphics } from 'pixi.js';

const SKY_TOP = 0x0d0820;
const SKY_HORIZON = 0x2a1452;
const SKYLINE = 0x1a1036;
const SKYLINE_FAR = 0x241848;
const WATER = 0x0e0a24;
const STREET = 0x12102a;
const BULB_COLORS = [colors.gold, colors.neon, colors.cyan, colors.gold];
/** Extra art past the design area, so letterboxed screens show more sky and street, not bars. */
const BLEED = 700;

/** Deterministic pseudo-random so the skyline doesn't change between rebuilds. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function lerpColor(a: number, b: number, t: number): number {
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 0xff) + (((b >> shift) & 0xff) - ((a >> shift) & 0xff)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

interface Layer {
  view: Container;
  /** How much of the camera's movement this layer follows (0 = fixed, 1 = with the floor). */
  depth: number;
}

/**
 * The promenade at night, in parallax layers: sky, a far and a near Valletta-style skyline
 * (domes, bell towers, bastions, lit windows), the harbour, the street the cabinets stand on and
 * strings of bulbs in front. Rebuilt when the orientation changes.
 */
export class Backdrop extends Container {
  private layers: Layer[] = [];
  private bulbs: Graphics[] = [];
  private waterLights = new Graphics();
  private time = 0;

  /**
   * `horizon` is where the skyline meets the water; `street` is where the promenade starts.
   * `span` is how far the camera can travel, so wide layers never show an edge.
   */
  build(width: number, height: number, horizon: number, street: number, span: number): void {
    this.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.layers = [];
    this.bulbs = [];
    // The old one was destroyed with its layer above.
    this.waterLights = new Graphics();
    const random = seeded(7);
    const wide = (depth: number) => width + span * depth + 200 + BLEED * 2;

    // Sky: banded gradient plus stars and a moon.
    const sky = new Graphics();
    const bands = 24;
    sky.rect(-BLEED, -BLEED, width + BLEED * 2, BLEED).fill(SKY_TOP);
    for (let i = 0; i < bands; i++) {
      const y = (i / bands) * horizon;
      sky
        .rect(-BLEED, y, width + BLEED * 2, horizon / bands + 1)
        .fill(lerpColor(SKY_TOP, SKY_HORIZON, i / (bands - 1)));
    }
    for (let i = 0; i < 90; i++) {
      sky.circle(random() * width, random() * horizon * 0.8, 0.6 + random() * 1.4).fill({
        color: 0xffffff,
        alpha: 0.3 + random() * 0.6,
      });
    }
    sky.circle(width * 0.82, horizon * 0.22, 46).fill({ color: 0xfff1c8, alpha: 0.08 });
    sky.circle(width * 0.82, horizon * 0.22, 30).fill(0xfff1c8);
    this.addLayer(sky, 0);

    // Far skyline: soft domes and towers.
    this.addLayer(this.skyline(wide(0.15), horizon, 0.55, SKYLINE_FAR, random, false), 0.15);
    // Near skyline: bastion wall, domes, bell towers and lit windows.
    this.addLayer(this.skyline(wide(0.3), horizon, 1, SKYLINE, random, true), 0.3);

    // Harbour with reflections that shimmer.
    const water = new Graphics().rect(-BLEED, horizon, wide(0.45), street - horizon).fill(WATER);
    const waterLayer = new Container({ children: [water, this.waterLights] });
    this.drawWaterLights(wide(0.45), horizon, street, random);
    this.addLayer(waterLayer, 0.45);

    // Promenade the cabinets stand on, with paving lines.
    const bottom = height + BLEED;
    const ground = new Graphics().rect(-BLEED, street, wide(1), bottom - street).fill(STREET);
    ground.rect(-BLEED, street, wide(1), 4).fill({ color: colors.neon, alpha: 0.5 });
    for (let x = -BLEED; x < wide(1); x += 90) {
      ground.moveTo(x, street + 4).lineTo(x - 40, height);
    }
    for (let y = street + 40; y < bottom; y += 46) ground.moveTo(-BLEED, y).lineTo(wide(1), y);
    ground.stroke({ color: 0xffffff, width: 1, alpha: 0.05 });
    this.addLayer(ground, 1);

    // Strings of bulbs hanging in front.
    const lights = new Container();
    const strings = new Graphics();
    const lightsWidth = wide(1.25);
    for (let x0 = -BLEED; x0 < lightsWidth; x0 += 320) {
      const x1 = x0 + 320;
      const sag = 46;
      const top = 18;
      strings.moveTo(x0, top).quadraticCurveTo((x0 + x1) / 2, top + sag * 2, x1, top);
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const x = x0 + (x1 - x0) * t;
        const y = top + sag * 2 * 2 * t * (1 - t);
        const bulb = new Graphics().circle(0, 0, 5).fill(0xffffff);
        bulb.position.set(x, y + 6);
        bulb.tint = BULB_COLORS[(i + Math.round((x0 + BLEED) / 320)) % BULB_COLORS.length]!;
        this.bulbs.push(bulb);
        lights.addChild(bulb);
      }
    }
    strings.stroke({ color: 0x000000, width: 2, alpha: 0.6 });
    lights.addChildAt(strings, 0);
    this.addLayer(lights, 1.25);
  }

  /** Moves each layer by its share of the camera offset. */
  setCamera(x: number): void {
    for (const { view, depth } of this.layers) view.x = -x * depth;
  }

  update(seconds: number): void {
    this.time += seconds;
    this.bulbs.forEach((bulb, i) => {
      bulb.alpha = 0.55 + 0.45 * Math.max(0, Math.sin(this.time * 2.2 + i * 1.7));
    });
    this.waterLights.alpha = 0.7 + Math.sin(this.time * 3) * 0.15;
  }

  private addLayer(view: Container, depth: number) {
    // No cacheAsTexture here: the wide phone layers would need textures thousands of pixels
    // across. Static Graphics already build their geometry once and batch well.
    this.layers.push({ view, depth });
    this.addChild(view);
  }

  private skyline(
    width: number,
    horizon: number,
    scale: number,
    color: number,
    random: () => number,
    windows: boolean,
  ): Graphics {
    const g = new Graphics();
    const lit: [number, number][] = [];
    let x = -BLEED;
    while (x < width) {
      const kind = random();
      const w = (60 + random() * 90) * scale;
      const h = (40 + random() * 80) * scale;
      // Base block (houses or a stretch of bastion wall).
      g.rect(x, horizon - h, w, h);
      if (kind < 0.22) {
        // Church dome on a drum, with a lantern.
        const cx = x + w / 2;
        const r = w * 0.32;
        g.rect(cx - r * 0.8, horizon - h - r * 0.6, r * 1.6, r * 0.6);
        g.circle(cx, horizon - h - r * 0.6, r);
        g.rect(cx - 3 * scale, horizon - h - r * 1.75, 6 * scale, r * 0.6);
      } else if (kind < 0.42) {
        // Bell tower with a pointed roof.
        const tw = w * 0.28;
        const tx = x + w * 0.2;
        const th = h * 0.9;
        g.rect(tx, horizon - h - th, tw, th);
        g.poly([
          tx - 3,
          horizon - h - th,
          tx + tw / 2,
          horizon - h - th - tw * 1.1,
          tx + tw + 3,
          horizon - h - th,
        ]);
      }
      if (windows) {
        for (let wy = horizon - h + 10 * scale; wy < horizon - 8; wy += 16 * scale) {
          for (let wx = x + 8 * scale; wx < x + w - 8 * scale; wx += 14 * scale) {
            if (random() < 0.22) lit.push([wx, wy]);
          }
        }
      }
      x += w;
    }
    g.fill(color);
    for (const [wx, wy] of lit)
      g.rect(wx, wy, 4 * scale, 5 * scale).fill({ color: colors.gold, alpha: 0.75 });
    return g;
  }

  private drawWaterLights(width: number, horizon: number, street: number, random: () => number) {
    const g = this.waterLights.clear();
    for (let i = 0; i < 70; i++) {
      const y = horizon + 6 + random() * (street - horizon - 12);
      const x = random() * width - BLEED;
      const w = 10 + random() * 40;
      g.rect(x, y, w, 2).fill({
        color: BULB_COLORS[i % BULB_COLORS.length]!,
        alpha: 0.25 + random() * 0.35,
      });
    }
  }
}

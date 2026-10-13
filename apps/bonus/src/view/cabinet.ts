import {
  arcadeFont,
  colors,
  Label,
  metalFill,
  verticalGradient,
  type Bounds,
  type Viewport,
} from '@lab/core';
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';

const MARQUEE_WIDTH = 560;

/**
 * Royal cabinet surrounds, using the same metal and neon treatment as Mini Slot. The stage is a
 * metal-framed window with a retrowave floor that Lucky and the chests stand on.
 */
export class BonusCabinet extends Container {
  private readonly backdrop: Sprite;
  private readonly shade = new Graphics();
  private readonly marquee = new Container();
  private readonly marqueeArt: Sprite;
  private readonly marqueeMask = new Graphics();
  private readonly trim = new Graphics();
  private readonly stage = new Graphics();
  private readonly deck = new Graphics();
  private readonly edition = new Label('ROYAL FORTUNE', 'caption', {
    fontFamily: arcadeFont,
    fill: 0xc5f6ff,
    fontSize: 11,
    letterSpacing: 4,
  });
  private readonly hint = new Label('PICK WITH 1 2 3 · ↑ ↓ STAKE', 'caption', {
    fontSize: 10,
    letterSpacing: 0.8,
    fill: 0xc2c0db,
  });
  private readonly specs = new Label('3 CHESTS / TOP PRIZE ×50', 'caption', {
    fontFamily: arcadeFont,
    fontSize: 10,
    fill: colors.cyan,
    letterSpacing: 1.5,
  });
  private readonly lights = new Graphics();
  private elapsed = 0;

  constructor(artwork: Texture) {
    super();
    this.eventMode = 'none';
    this.backdrop = new Sprite(artwork);
    this.backdrop.anchor.set(0.5);
    this.marqueeArt = new Sprite(artwork);
    this.marqueeArt.anchor.set(0.5);
    this.marqueeArt.mask = this.marqueeMask;
    this.marquee.addChild(this.trim, this.marqueeArt, this.marqueeMask, this.edition);
    this.edition.anchor.set(0.5);
    this.hint.anchor.set(0.5);
    this.specs.anchor.set(0.5);
    this.addChild(
      this.backdrop,
      this.shade,
      this.marquee,
      this.stage,
      this.deck,
      this.hint,
      this.specs,
      this.lights,
    );
  }

  /**
   * `stage` frames Lucky and the chests, with its floor starting at `horizon`; `deck` is the
   * control panel's rectangle.
   */
  arrange(
    { width, height, orientation, screen }: Viewport,
    specsY: number,
    stage: Bounds,
    horizon: number,
    deck: Bounds,
  ): void {
    const portrait = orientation === 'portrait';
    this.hint.text = portrait ? 'TAP A CHEST · + / − STAKE' : 'PICK WITH 1 2 3 · ↑ ↓ STAKE';
    // The art and its shade cover the whole window, letterbox bars included.
    const scale = Math.max(
      screen.width / this.backdrop.texture.width,
      screen.height / this.backdrop.texture.height,
    );
    this.backdrop.scale.set(scale);
    this.backdrop.position.set(width / 2, height / 2);
    this.shade
      .clear()
      .rect(screen.x, screen.y, screen.width, screen.height)
      .fill(
        verticalGradient([
          [0, '#09091a'],
          [0.5, '#110a28'],
          [1, '#080917'],
        ]),
      );
    this.shade.alpha = 0.76;

    const centerX = stage.x + stage.width / 2;
    const machineX = centerX - MARQUEE_WIDTH / 2;
    const mw = MARQUEE_WIDTH + 12;
    this.marquee.position.set(machineX - 6, portrait ? 82 : 34);
    this.trim
      .clear()
      .roundRect(-7, -7, mw + 14, 115, 16)
      .fill(0x090916)
      .roundRect(-2, -2, mw + 4, 105, 12)
      .fill(metalFill())
      .roundRect(4, 4, mw - 8, 93, 8)
      .fill(0x130b25)
      .stroke({ color: colors.neon, width: 2 })
      .roundRect(4, 4, mw - 8, 93, 8)
      .stroke({ color: colors.neon, width: 9, alpha: 0.13 });
    this.marqueeMask
      .clear()
      .roundRect(6, 6, mw - 12, 89, 7)
      .fill(0xffffff);
    // Frame the crown in the marquee.
    this.marqueeArt.scale.set(mw / this.marqueeArt.texture.width);
    this.marqueeArt.position.set(mw / 2, 95);
    this.marqueeArt.alpha = 0.75;
    this.edition.position.set(mw / 2, 17);

    this.drawStage(stage, horizon);
    this.drawDeck(deck);
    this.hint.position.set(deck.x + deck.width / 2, deck.y + deck.height - 23);
    this.specs.position.set(centerX, specsY);
    this.lights.clear();
    for (let i = 0; i < 11; i++) {
      const x = machineX + 15 + (i * (MARQUEE_WIDTH - 30)) / 10;
      const y = portrait ? 191 : 143;
      this.lights.circle(x, y, 4).fill(i % 2 ? 0xff8bd0 : 0xa1f8ff);
    }
  }

  update(seconds: number): void {
    this.elapsed += seconds;
    this.lights.alpha = 0.7 + Math.sin(this.elapsed * 2) * 0.2;
  }

  /** Metal bezel, dark sky with a faint golden burst, and a neon grid floor to the horizon. */
  private drawStage({ x, y, width, height }: Bounds, horizon: number) {
    const g = this.stage.clear();
    g.roundRect(x - 12, y - 8, width + 24, height + 22, 26)
      .fill({ color: 0x050611, alpha: 0.85 })
      .roundRect(x - 10, y - 10, width + 20, height + 20, 26)
      .fill(metalFill())
      .stroke({ color: 0xabb7d4, width: 2 })
      .roundRect(x, y, width, height, 18)
      .fill(
        verticalGradient([
          [0, '#0b0a1f'],
          [0.6, '#1a0d33'],
          [1, '#120a24'],
        ]),
      );

    const cx = x + width / 2;
    // Crown-burst rays from behind the chests, kept faint so the prizes stay readable.
    const rays = 14;
    for (let i = 0; i < rays; i++) {
      const a = Math.PI + (i / (rays - 1)) * Math.PI;
      const spread = 0.05;
      const r = width * 0.6;
      g.poly([
        cx,
        horizon,
        cx + Math.cos(a - spread) * r,
        Math.max(y + 6, horizon + Math.sin(a - spread) * r),
        cx + Math.cos(a + spread) * r,
        Math.max(y + 6, horizon + Math.sin(a + spread) * r),
      ]).fill({ color: colors.gold, alpha: 0.05 });
    }

    // Floor: lines fanning out from a vanishing point, rungs closing up towards the horizon.
    const bottom = y + height - 6;
    g.rect(x + 6, horizon, width - 12, bottom - horizon).fill({ color: 0x24104a, alpha: 0.6 });
    for (let i = -8; i <= 8; i++) {
      g.moveTo(cx + i * 6, horizon).lineTo(cx + i * (width / 9), bottom);
    }
    for (let i = 1; i <= 6; i++) {
      const t = (i / 6) ** 2;
      const ry = horizon + t * (bottom - horizon);
      g.moveTo(x + 6, ry).lineTo(x + width - 6, ry);
    }
    g.stroke({ color: colors.neon, width: 1.5, alpha: 0.35 });
    g.moveTo(x + 6, horizon)
      .lineTo(x + width - 6, horizon)
      .stroke({ color: 0xff8bd0, width: 2, alpha: 0.7 });

    g.roundRect(x, y, width, height, 18)
      .stroke({ color: colors.neon, width: 3, alpha: 0.9 })
      .roundRect(x + 4, y + 4, width - 8, height - 8, 15)
      .stroke({ color: colors.neon, width: 9, alpha: 0.13 });
  }

  private drawDeck({ x: dx, y: dy, width: dw, height: dh }: Bounds) {
    this.deck
      .clear()
      .roundRect(dx - 4, dy + 5, dw + 8, dh, 20)
      .fill(0x070813)
      .roundRect(dx, dy, dw, dh, 16)
      .fill(metalFill())
      .stroke({ color: 0x969cba, width: 1 })
      .roundRect(dx + 8, dy + 8, dw - 16, dh - 16, 11)
      .fill(0x141328)
      .stroke({ color: colors.cyan, width: 1, alpha: 0.45 });
    for (const x of [dx + 17, dx + dw - 17]) {
      for (const y of [dy + 17, dy + dh - 17]) {
        this.deck
          .circle(x, y, 3)
          .fill(0x9da3bd)
          .moveTo(x - 2, y)
          .lineTo(x + 2, y)
          .stroke({ color: 0x252638, width: 1 });
      }
    }
  }
}

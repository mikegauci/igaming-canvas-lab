import { arcadeFont, colors, Label, metalFill, verticalGradient, type Viewport } from '@lab/core';
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';

/** Decorative Miami cabinet surrounds; gameplay remains in the reel and HUD layers. */
export class SlotCabinet extends Container {
  private readonly backdrop: Sprite;
  private readonly shade = new Graphics();
  private readonly marquee = new Container();
  private readonly marqueeArt: Sprite;
  private readonly marqueeMask = new Graphics();
  private readonly trim = new Graphics();
  private readonly deck = new Graphics();
  private readonly edition = new Label('MIAMI NIGHTS', 'caption', {
    fontFamily: arcadeFont,
    fill: 0xc5f6ff,
    fontSize: 11,
    letterSpacing: 4,
  });
  private readonly hint = new Label('SPACE TO SPIN · ↑ ↓ BET', 'caption', {
    fontSize: 11,
    letterSpacing: 1,
    fill: 0xc2c0db,
  });
  private readonly specs = new Label('3 REELS / 5 PAYLINES', 'caption', {
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
      this.deck,
      this.hint,
      this.specs,
      this.lights,
    );
  }

  arrange(
    { width, height, orientation }: Viewport,
    machineX: number,
    machineY: number,
    machineWidth: number,
  ): void {
    const portrait = orientation === 'portrait';
    this.hint.text = portrait ? 'TAP TO SPIN · + / − BET' : 'SPACE TO SPIN · ↑ ↓ BET';
    const cx = width / 2;
    const scale = Math.max(
      width / this.backdrop.texture.width,
      height / this.backdrop.texture.height,
    );
    this.backdrop.scale.set(scale);
    this.backdrop.position.set(cx, height / 2);
    this.shade
      .clear()
      .rect(0, 0, width, height)
      .fill(
        verticalGradient([
          [0, '#09091a'],
          [0.5, '#110a28'],
          [1, '#080917'],
        ]),
      );
    this.shade.alpha = 0.76;

    const mw = machineWidth + 12;
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
    this.marqueeArt.scale.set(mw / this.marqueeArt.texture.width);
    this.marqueeArt.position.set(mw / 2, 75);
    this.marqueeArt.alpha = 0.75;
    this.edition.position.set(mw / 2, 17);

    const dx = portrait ? 65 : 944;
    const dy = portrait ? machineY + 474 : 242;
    const dw = portrait ? 590 : 232;
    const dh = portrait ? 178 : 342;
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
    this.hint.position.set(portrait ? cx : dx + dw / 2, portrait ? dy + dh - 20 : dy + dh - 23);
    this.specs.position.set(machineX + machineWidth / 2, portrait ? machineY + 450 : machineY - 17);
    this.lights.clear();
    for (let i = 0; i < 11; i++) {
      const x = machineX + 15 + (i * (machineWidth - 30)) / 10;
      const y = portrait ? 191 : 143;
      this.lights.circle(x, y, 4).fill(i % 2 ? 0xff8bd0 : 0xa1f8ff);
    }
  }

  update(seconds: number): void {
    this.elapsed += seconds;
    this.lights.alpha = 0.7 + Math.sin(this.elapsed * 2) * 0.2;
  }
}

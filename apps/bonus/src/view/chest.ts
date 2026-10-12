import { colors, fontFamily } from '@lab/core';
import { gsap } from 'gsap';
import { BitmapText, Container, Graphics } from 'pixi.js';

export const CHEST_WIDTH = 170;
export const CHEST_HEIGHT = 146;

const WOOD = 0x7a3e1d;
const WOOD_LIGHT = 0x8b4a22;
const METAL = 0xb8901a;

/** Colour for a prize label: rarer prizes get the brighter colours. */
export const prizeColor = (multiplier: number): number =>
  multiplier >= 50
    ? colors.neon
    : multiplier >= 25
      ? colors.cyan
      : multiplier >= 10
        ? colors.gold
        : multiplier > 0
          ? colors.text
          : colors.muted;

export const prizeLabel = (multiplier: number): string =>
  multiplier === 0 ? 'EMPTY' : `×${multiplier}`;

/** A treasure chest, drawn front-on with its origin at the bottom centre. */
export class Chest extends Container {
  onPick?: () => void;

  private readonly glow = new Graphics()
    .circle(0, -70, 120)
    .fill({ color: colors.gold, alpha: 0.5 });
  private readonly light = new Graphics();
  private readonly lid = new Container();
  private readonly box = new Container();
  private readonly prize: BitmapText;
  private readonly hint: BitmapText;
  private _enabled = true;

  constructor(index: number) {
    super();
    const base = new Graphics()
      .roundRect(-85, -100, 170, 100, 14)
      .fill(WOOD)
      .stroke({ color: colors.gold, width: 6 })
      .rect(-62, -100, 14, 100)
      .fill(METAL)
      .rect(48, -100, 14, 100)
      .fill(METAL)
      .roundRect(-16, -82, 32, 36, 6)
      .fill(colors.gold)
      .circle(0, -68, 5)
      .fill(0x2b1a0a)
      .rect(-2, -66, 4, 10)
      .fill(0x2b1a0a);
    // Interior light, only visible once the lid is up.
    this.light.rect(-78, -104, 156, 10).fill(colors.gold);
    this.light.alpha = 0;
    const lidArt = new Graphics()
      .roundRect(-85, -46, 170, 46, 20)
      .fill(WOOD_LIGHT)
      .stroke({ color: colors.gold, width: 6 })
      .rect(-62, -44, 14, 44)
      .fill(METAL)
      .rect(48, -44, 14, 44)
      .fill(METAL);
    this.lid.addChild(lidArt);
    // Hinged along the back edge of the box.
    this.lid.position.set(0, -100);

    this.glow.alpha = 0;
    this.glow.blendMode = 'add';
    this.box.addChild(this.glow, base, this.light, this.lid);

    this.prize = new BitmapText({
      text: '',
      style: { fontFamily, fontSize: 44, fontWeight: 'bold', fill: 0xffffff },
    });
    this.prize.anchor.set(0.5);
    this.prize.alpha = 0;
    this.hint = new BitmapText({
      text: `${index + 1}`,
      style: { fontFamily, fontSize: 16, fontWeight: 'bold', fill: 0xffffff },
    });
    this.hint.anchor.set(0.5, 0);
    this.hint.position.set(0, 12);
    this.hint.tint = colors.muted;
    this.addChild(this.box, this.prize, this.hint);

    this.accessible = true;
    this.accessibleType = 'button';
    this.accessibleTitle = `Chest ${index + 1} (key ${index + 1})`;
    this.on(
      'pointerover',
      () => this._enabled && gsap.to(this.box.scale, { x: 1.06, y: 1.06, duration: 0.15 }),
    );
    this.on('pointerout', () => gsap.to(this.box.scale, { x: 1, y: 1, duration: 0.15 }));
    this.on('pointertap', () => this._enabled && this.onPick?.());
    this.enabled = true;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.eventMode = value ? 'static' : 'none';
    this.cursor = value ? 'pointer' : 'default';
    if (!value) gsap.to(this.box.scale, { x: 1, y: 1, duration: 0.15 });
  }

  /** Nervous wobble while the server decides. */
  shake(): void {
    gsap.to(this.box, {
      rotation: 0.06,
      duration: 0.07,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
    gsap.to(this.lid, { y: -104, duration: 0.09, yoyo: true, repeat: -1 });
  }

  /** Flips the lid open and pops the prize label out. `featured` adds the glow burst. */
  async open(multiplier: number, { featured = true, dimmed = false } = {}): Promise<void> {
    gsap.killTweensOf([this.box, this.lid]);
    this.box.rotation = 0;
    this.prize.text = prizeLabel(multiplier);
    this.prize.tint = prizeColor(multiplier);
    this.prize.position.set(0, -110);
    this.prize.scale.set(0.4);
    const tl = gsap.timeline();
    tl.to(this.lid, { y: -128, rotation: -0.5, duration: 0.35, ease: 'back.out(2)' })
      .to(this.light, { alpha: 1, duration: 0.2 }, '<')
      .to(
        this.prize,
        { y: -190, alpha: dimmed ? 0.6 : 1, duration: 0.45, ease: 'back.out(1.8)' },
        '<0.1',
      )
      .to(this.prize.scale, { x: 1, y: 1, duration: 0.45, ease: 'back.out(1.8)' }, '<');
    if (featured && multiplier > 0) {
      tl.fromTo(this.glow, { alpha: 0.9 }, { alpha: 0, duration: 1.2 }, '<').fromTo(
        this.glow.scale,
        { x: 0.4, y: 0.4 },
        { x: 1.6, y: 1.6, duration: 1.2, ease: 'power2.out' },
        '<',
      );
    }
    if (dimmed) tl.to(this.box, { alpha: 0.55, duration: 0.3 }, '<');
    await tl;
  }

  /** Lid down, label away, ready for the next pick. */
  async close(): Promise<void> {
    gsap.killTweensOf([this.box, this.lid, this.prize, this.glow]);
    await gsap
      .timeline()
      .to(this.prize, { alpha: 0, y: -120, duration: 0.2 })
      .to(this.lid, { y: -100, rotation: 0, duration: 0.25, ease: 'power2.in' }, '<')
      .to(this.light, { alpha: 0, duration: 0.2 }, '<')
      .to(this.box, { alpha: 1, rotation: 0, duration: 0.2 }, '<');
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    gsap.killTweensOf([
      this.box,
      this.box.scale,
      this.lid,
      this.prize,
      this.prize.scale,
      this.glow,
      this.glow.scale,
      this.light,
    ]);
    super.destroy(...args);
  }
}

import { colors } from '@lab/core';
import { gsap } from 'gsap';
import { Container, Graphics, Text } from 'pixi.js';
import { createAttract, SCREEN_HEIGHT, SCREEN_WIDTH, type Attract } from './attract';
import { displayFont } from './fonts';
import type { GameInfo } from './games';

export const CABINET_WIDTH = 200;
export const CABINET_HEIGHT = 340;
/** Where the screen sits inside the cabinet (origin at the cabinet's bottom centre). */
export const SCREEN_TOP = -268;

/**
 * An arcade cabinet for one game: marquee, a screen running the game's attract loop, a control
 * deck with PLAY, and a glow on the floor. Origin at the bottom centre.
 */
export class Cabinet extends Container {
  onSelect?: () => void;
  onPlay?: () => void;

  readonly game: GameInfo;
  private readonly body = new Container();
  private readonly marquee = new Graphics();
  private readonly marqueeGlow = new Graphics();
  private readonly title: Text;
  private readonly play: Text;
  private readonly floorGlow: Graphics;
  private readonly attract: Attract;
  private selected = false;

  constructor(game: GameInfo) {
    super();
    this.game = game;
    const { color } = game;
    const w = CABINET_WIDTH;

    this.floorGlow = new Graphics().ellipse(0, 0, 130, 22).fill({ color, alpha: 0.35 });
    this.floorGlow.alpha = 0.3;

    const shell = new Graphics()
      // Cabinet sides, slightly wider at the deck like a real upright.
      .poly([
        -w / 2,
        -CABINET_HEIGHT + 30,
        w / 2,
        -CABINET_HEIGHT + 30,
        w / 2 + 10,
        -70,
        w / 2,
        0,
        -w / 2,
        0,
        -w / 2 - 10,
        -70,
      ])
      .fill(0x1a1a33)
      .stroke({ color, width: 3, alpha: 0.9 })
      // Screen bezel.
      .roundRect(-SCREEN_WIDTH / 2 - 10, SCREEN_TOP - 10, SCREEN_WIDTH + 20, SCREEN_HEIGHT + 20, 12)
      .fill(0x0b0b14)
      // Control deck with a joystick and two buttons.
      .poly([-w / 2 - 10, -100, w / 2 + 10, -100, w / 2 + 14, -70, -w / 2 - 14, -70])
      .fill(0x24244a)
      .circle(-50, -88, 9)
      .fill(0x0b0b14)
      .circle(-50, -96, 6)
      .fill(color)
      .circle(40, -86, 8)
      .fill(colors.neon)
      .circle(64, -86, 8)
      .fill(colors.cyan)
      // Coin door.
      .roundRect(-22, -52, 44, 30, 4)
      .fill(0x24244a)
      .rect(-3, -46, 6, 14)
      .fill(colors.gold);

    this.marqueeGlow
      .roundRect(-w / 2 - 6, -CABINET_HEIGHT - 6, w + 12, 50, 14)
      .fill({ color, alpha: 0.6 });
    this.marqueeGlow.alpha = 0;
    this.marquee
      .roundRect(-w / 2, -CABINET_HEIGHT, w, 40, 10)
      .fill(0x0b0b14)
      .stroke({ color, width: 3 });
    this.title = new Text({
      text: game.title,
      style: {
        fontFamily: displayFont,
        fontSize: 17,
        fontWeight: '900',
        fill: color,
        letterSpacing: 2,
      },
    });
    this.title.anchor.set(0.5);
    this.title.position.set(0, -CABINET_HEIGHT + 20);
    this.title.alpha = 0.6;

    this.attract = createAttract(game.id);
    this.attract.position.set(-SCREEN_WIDTH / 2, SCREEN_TOP);
    const screenMask = new Graphics()
      .roundRect(-SCREEN_WIDTH / 2, SCREEN_TOP, SCREEN_WIDTH, SCREEN_HEIGHT, 6)
      .fill(0xffffff);
    this.attract.mask = screenMask;

    this.play = new Text({
      text: 'PLAY ▶',
      style: {
        fontFamily: displayFont,
        fontSize: 13,
        fontWeight: '700',
        fill: colors.text,
        letterSpacing: 2,
      },
    });
    this.play.anchor.set(0.5);
    this.play.position.set(0, -118);
    this.play.alpha = 0.35;

    this.body.addChild(
      this.marqueeGlow,
      shell,
      this.marquee,
      this.title,
      this.attract,
      screenMask,
      this.play,
    );
    this.addChild(this.floorGlow, this.body);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.accessible = true;
    this.accessibleType = 'button';
    this.accessibleTitle = `Play ${game.title}`;
    this.accessibleHint = game.caption;
    // Keyboard focus from Pixi's accessibility layer arrives as mouseover.
    this.on('pointerover', () => this.onSelect?.());
    this.on('mouseover', () => this.onSelect?.());
    this.on('pointertap', () => this.onPlay?.());
  }

  /** Global position of the screen centre, for the zoom-in. */
  get screenCenter(): { x: number; y: number } {
    return this.toGlobal({ x: 0, y: SCREEN_TOP + SCREEN_HEIGHT / 2 });
  }

  setSelected(selected: boolean): void {
    if (selected === this.selected) return;
    this.selected = selected;
    gsap.to(this.body, { y: selected ? -10 : 0, duration: 0.25, ease: 'power2.out' });
    gsap.to(this.marqueeGlow, { alpha: selected ? 1 : 0, duration: 0.25 });
    gsap.to(this.title, { alpha: selected ? 1 : 0.6, duration: 0.25 });
    gsap.to(this.play, { alpha: selected ? 1 : 0.35, duration: 0.25 });
    gsap.to(this.floorGlow, { alpha: selected ? 1 : 0.3, duration: 0.25 });
  }

  update(seconds: number, time: number): void {
    this.attract.update(seconds);
    // Selected marquee flickers like an old neon tube.
    if (this.selected)
      this.marqueeGlow.alpha = 0.85 + Math.sin(time * 23) * 0.08 + Math.sin(time * 7) * 0.07;
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    gsap.killTweensOf([this.body, this.marqueeGlow, this.title, this.play, this.floorGlow]);
    super.destroy(...args);
  }
}

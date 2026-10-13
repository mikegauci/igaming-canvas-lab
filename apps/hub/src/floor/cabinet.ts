import { colors } from '@lab/core';
import { gsap } from 'gsap';
import { Container, FillGradient, Graphics, Rectangle, Text, type Filter } from 'pixi.js';
import { createAttract, SCREEN_HEIGHT, SCREEN_WIDTH, type Attract } from './attract';
import type { GameInfo } from './games';
import { neonStyle, tubeCore } from './neon';

export const CABINET_WIDTH = 200;
export const CABINET_HEIGHT = 340;
/** Where the screen sits inside the cabinet (origin at the cabinet's bottom centre). */
export const SCREEN_TOP = -268;

const W = CABINET_WIDTH;
const H = CABINET_HEIGHT;
const MARQUEE_HEIGHT = 40;
const BULBS_PER_ROW = 9;
/** The upright's outline: slightly wider at the deck, like a real cabinet. */
const SHELL = [
  -W / 2,
  -H + 30,
  W / 2,
  -H + 30,
  W / 2 + 10,
  -70,
  W / 2,
  0,
  -W / 2,
  0,
  -W / 2 - 10,
  -70,
];

const vertical = (stops: [number, number][]) =>
  new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    textureSpace: 'local',
    colorStops: stops.map(([offset, color]) => ({ offset, color })),
  });

/**
 * An arcade cabinet for one game, drawn in code: a gradient shell edged with a neon tube, a lit
 * marquee with chasing bulbs, a CRT screen running the game's attract loop behind a glass glare,
 * a control deck and coin door, and a pool of light with tube reflections on the grid floor.
 * Origin at the bottom centre.
 */
export class Cabinet extends Container {
  onSelect?: () => void;
  onPlay?: () => void;

  readonly game: GameInfo;
  private readonly body = new Container();
  private readonly tube = new Graphics();
  private readonly marqueeLight = new Graphics();
  private readonly bulbs: Graphics[] = [];
  private readonly screen = new Container();
  private readonly play: Text;
  private readonly glow = new Graphics();
  private readonly attract: Attract;
  private selected = false;
  private chase = 0;
  private buzz = 0;

  constructor(game: GameInfo) {
    super();
    this.game = game;
    const { color } = game;

    // Light pool and tube reflections on the floor, under everything else.
    for (let i = 5; i >= 1; i--) {
      this.glow.ellipse(0, 4, 40 + i * 24, 6 + i * 5).fill({ color, alpha: 0.07 });
    }
    for (const x of [-W / 2 - 1, W / 2 + 1]) {
      for (let i = 0; i < 6; i++) {
        this.glow.rect(x - 1.5, 4 + i * 9, 3, 9).fill({ color, alpha: 0.35 * (1 - i / 6) });
      }
    }
    this.glow.alpha = 0.45;

    const shell = new Graphics()
      .poly(SHELL)
      .fill(
        vertical([
          [0, 0x2a1048],
          [1, 0x0f0620],
        ]),
      )
      // Front panel, a shade lighter, inset from the sides.
      .poly([-W / 2 + 12, -H + 44, W / 2 - 12, -H + 44, W / 2 - 4, -104, -W / 2 + 4, -104])
      .fill({ color: 0x3a1a5e, alpha: 0.35 });

    // Neon tube along the shell's edge: wide faint glow, brighter halo, white-hot core.
    this.tube
      .poly(SHELL)
      .stroke({ color, width: 10, alpha: 0.16, join: 'round' })
      .poly(SHELL)
      .stroke({ color, width: 4, alpha: 0.5, join: 'round' })
      .poly(SHELL)
      .stroke({ color: tubeCore(color), width: 1.6, join: 'round' })
      // Kick-plate strip.
      .roundRect(-W / 2 + 8, -9, W - 16, 3, 1.5)
      .fill({ color, alpha: 0.8 });

    // Marquee: a lightbox backlit in the game's colour.
    const marquee = new Graphics()
      .roundRect(-W / 2, -H, W, MARQUEE_HEIGHT, 8)
      .fill(0x07020f)
      .roundRect(-W / 2 + 4, -H + 4, W - 8, MARQUEE_HEIGHT - 8, 6)
      .fill(
        vertical([
          [0, 0x12051f],
          [1, color],
        ]),
      );
    this.marqueeLight
      .roundRect(-W / 2 + 4, -H + 4, W - 8, MARQUEE_HEIGHT - 8, 6)
      .fill({ color, alpha: 0.35 });
    const title = new Text({
      text: game.title,
      style: neonStyle(color, 16, { fontWeight: '900', letterSpacing: 2 }),
    });
    title.anchor.set(0.5);
    title.position.set(0, -H + MARQUEE_HEIGHT / 2);
    const bulbLayer = new Container();
    for (const y of [-H - 1, -H + MARQUEE_HEIGHT + 1]) {
      for (let i = 0; i < BULBS_PER_ROW; i++) {
        const bulb = new Graphics()
          .circle(0, 0, 3.2)
          .fill(0xffffff)
          .circle(0, 0, 6)
          .fill({ color: 0xffffff, alpha: 0.18 });
        bulb.tint = colors.gold;
        bulb.position.set(-W / 2 + 12 + (i * (W - 24)) / (BULBS_PER_ROW - 1), y);
        this.bulbs.push(bulb);
        bulbLayer.addChild(bulb);
      }
    }

    // Screen: dark bezel, then the attract loop on a tube, then the glass on top.
    const bezel = new Graphics()
      .roundRect(-SCREEN_WIDTH / 2 - 12, SCREEN_TOP - 12, SCREEN_WIDTH + 24, SCREEN_HEIGHT + 24, 12)
      .fill(0x05020c)
      .stroke({ color: 0x2b1a44, width: 2 });
    this.attract = createAttract(game.id);
    const screenMask = new Graphics()
      .roundRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 8)
      .fill(0xffffff);
    this.attract.mask = screenMask;
    this.screen.addChild(
      new Graphics().roundRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 8).fill(0x0a0614),
      this.attract,
      screenMask,
    );
    this.screen.position.set(-SCREEN_WIDTH / 2, SCREEN_TOP);
    // The filter covers exactly the tube, however far the attract art pokes out of it.
    this.screen.filterArea = new Rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    const glass = new Graphics()
      .poly([
        -SCREEN_WIDTH / 2 + 6,
        SCREEN_TOP + 4,
        -SCREEN_WIDTH / 2 + 70,
        SCREEN_TOP + 4,
        -SCREEN_WIDTH / 2 + 20,
        SCREEN_TOP + SCREEN_HEIGHT - 4,
        -SCREEN_WIDTH / 2 + 6,
        SCREEN_TOP + SCREEN_HEIGHT - 4,
      ])
      .fill({ color: 0xffffff, alpha: 0.05 })
      .roundRect(-SCREEN_WIDTH / 2 + 10, SCREEN_TOP + 3, SCREEN_WIDTH - 20, 2, 1)
      .fill({ color: 0xffffff, alpha: 0.12 });

    this.play = new Text({ text: 'PLAY ▶', style: neonStyle(color, 12, { letterSpacing: 2 }) });
    this.play.anchor.set(0.5);
    this.play.position.set(0, -118);
    this.play.alpha = 0.3;

    // Control deck with a joystick and two buttons, and the coin door below it.
    const deck = new Graphics()
      .poly([-W / 2 - 10, -100, W / 2 + 10, -100, W / 2 + 14, -70, -W / 2 - 14, -70])
      .fill(
        vertical([
          [0, 0x4a2a78],
          [1, 0x1d0f33],
        ]),
      )
      .moveTo(-W / 2 - 10, -100)
      .lineTo(W / 2 + 10, -100)
      .stroke({ color, width: 1.5, alpha: 0.6 })
      // Joystick: shaft, ball and a highlight.
      .ellipse(-50, -84, 11, 4)
      .fill(0x05020c)
      .rect(-51.5, -98, 3, 14)
      .fill(0x8c86a8)
      .circle(-50, -100, 7)
      .fill(color)
      .circle(-52.5, -102.5, 2.2)
      .fill({ color: 0xffffff, alpha: 0.7 });
    for (const [x, buttonColor] of [
      [36, colors.neon],
      [62, colors.cyan],
    ] as const) {
      deck
        .ellipse(x, -84, 10, 5)
        .fill(0x05020c)
        .ellipse(x, -87, 9, 4.5)
        .fill(buttonColor)
        .ellipse(x - 2.5, -88.5, 3, 1.4)
        .fill({ color: 0xffffff, alpha: 0.6 });
    }
    const door = new Graphics()
      .roundRect(-30, -56, 60, 38, 4)
      .fill(0x1d0f33)
      .stroke({ color: 0x3a2160, width: 1.5 });
    for (const x of [-14, 14]) {
      door
        .roundRect(x - 7, -50, 14, 12, 2)
        .fill({ color: 0xff5a3d, alpha: 0.25 })
        .roundRect(x - 1.2, -48, 2.4, 8, 1)
        .fill(0xffb38a);
    }

    this.body.addChild(
      shell,
      this.tube,
      marquee,
      this.marqueeLight,
      title,
      bulbLayer,
      bezel,
      this.screen,
      glass,
      this.play,
      deck,
      door,
    );
    this.addChild(this.glow, this.body);

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
    this.applySelected(0);
  }

  /** Global position of the screen centre, for the zoom-in. */
  get screenCenter(): { x: number; y: number } {
    return this.toGlobal({ x: 0, y: SCREEN_TOP + SCREEN_HEIGHT / 2 });
  }

  /** The CRT pass for the screen (shared by every cabinet), or null to show it flat. */
  set crt(filter: Filter | null) {
    this.screen.filters = filter ? [filter] : [];
  }

  setSelected(selected: boolean): void {
    if (selected === this.selected) return;
    this.selected = selected;
    this.applySelected(0.25);
  }

  update(seconds: number): void {
    this.attract.update(seconds);
    // Bulbs chase round the marquee, faster on the selected cabinet.
    this.chase += seconds * (this.selected ? 14 : 5);
    this.bulbs.forEach((bulb, i) => {
      const lit = (Math.floor(this.chase) + i) % 3 === 0;
      bulb.alpha = lit ? 1 : 0.25;
    });
    // The selected cabinet's tube buzzes: now and then it dips for a frame or two.
    if (this.selected) {
      this.buzz -= seconds;
      if (this.buzz < 0) this.buzz = Math.random() < 0.04 ? 0.06 : 0;
      this.tube.alpha = this.buzz > 0 ? 0.55 : 1;
    }
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    gsap.killTweensOf([this.body, this.tube, this.marqueeLight, this.screen, this.play, this.glow]);
    super.destroy(...args);
  }

  private applySelected(duration: number) {
    const on = this.selected;
    gsap.to(this.body, { y: on ? -10 : 0, duration, ease: 'power2.out' });
    gsap.to(this.tube, { alpha: on ? 1 : 0.5, duration });
    gsap.to(this.marqueeLight, { alpha: on ? 1 : 0, duration });
    gsap.to(this.screen, { alpha: on ? 1 : 0.72, duration });
    gsap.to(this.play, { alpha: on ? 1 : 0.3, duration });
    gsap.to(this.glow, { alpha: on ? 1 : 0.45, duration });
  }
}

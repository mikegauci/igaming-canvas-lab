import { colors } from '@lab/core';
import { gsap } from 'gsap';
import {
  Container,
  FillGradient,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type Filter,
} from 'pixi.js';
import { createAttract, draw, SCREEN_HEIGHT, SCREEN_WIDTH, type Attract } from './attract';
import { displayFont } from './fonts';
import type { GameInfo } from './games';
import { neonStyle, tubeCore } from './neon';

export const CABINET_WIDTH = 200;
export const CABINET_HEIGHT = 410;
/** Where the screen sits inside the cabinet (origin at the cabinet's bottom centre). */
export const SCREEN_TOP = -334;

const W = CABINET_WIDTH;
const H = CABINET_HEIGHT;
const MARQUEE_HEIGHT = 50;
const BULBS_PER_ROW = 11;
/** The control deck: its back edge, and its front lip. */
const DECK_TOP = -170;
const DECK_FRONT = -142;
/** The decorated lower front, under the deck, where the game's artwork is printed. */
const ART_TOP = -134;
const ART_BOTTOM = -12;
const ART = new Rectangle(-W / 2 - 3, ART_TOP, W + 6, ART_BOTTOM - ART_TOP);
/** The upright's outline: wider at the deck and below it, like a real cabinet. */
const SHELL = [
  -W / 2,
  -H + 24,
  W / 2,
  -H + 24,
  W / 2,
  DECK_TOP,
  W / 2 + 12,
  DECK_FRONT,
  W / 2 + 8,
  0,
  -W / 2 - 8,
  0,
  -W / 2 - 12,
  DECK_FRONT,
  -W / 2,
  DECK_TOP,
];

const vertical = (stops: [number, number][]) =>
  new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    textureSpace: 'local',
    colorStops: stops.map(([offset, color]) => ({ offset, color })),
  });

/** Brushed silver for the bevels and trim, shared by every cabinet (it maps to each shape). */
const SILVER = vertical([
  [0, 0xf4f2fb],
  [0.45, 0x9c97b4],
  [0.55, 0x6c6788],
  [1, 0xd9d5e8],
]);

/**
 * A sprite filling `box` with `texture` cropped to cover it without stretching: centred, except
 * that `focusY` picks which band survives a vertical crop. The crop is a texture frame, not a
 * mask, so it costs no stencil pass.
 */
function cover(texture: Texture, box: Rectangle, focusY = 0.5) {
  const { width: tw, height: th } = texture;
  const scale = Math.max(box.width / tw, box.height / th);
  const w = box.width / scale;
  const h = box.height / scale;
  const frame = new Rectangle((tw - w) / 2, (th - h) * focusY, w, h);
  const sprite = new Sprite(new Texture({ source: texture.source, frame }));
  sprite.position.set(box.x, box.y);
  sprite.setSize(box.width, box.height);
  return sprite;
}

/** The little badge over each marquee: cherries, a star, a gem, a rocket or a crown. */
function emblem(game: GameInfo['id'], titleWidth: number): Container {
  const g = new Graphics();
  switch (game) {
    case 'slot':
      draw.cherries(g, 0, -H - 2, 10);
      break;
    case 'wheel':
      draw.star(g, 0, -H - 3, 15);
      break;
    case 'scratch':
      draw.gem(g, 0, -H - 3, 14, 0x7fe9ff);
      break;
    case 'crash': {
      const rocket = draw.rocket();
      rocket.scale.set(1.1);
      rocket.rotation = -0.55;
      rocket.position.set(titleWidth / 2 + 14, -H + MARQUEE_HEIGHT / 2 - 6);
      return rocket;
    }
    case 'bonus':
      g.poly([
        -16,
        -H + 4,
        -18,
        -H - 12,
        -8,
        -H - 4,
        0,
        -H - 16,
        8,
        -H - 4,
        18,
        -H - 12,
        16,
        -H + 4,
      ])
        .fill(
          vertical([
            [0, 0xfff1a8],
            [1, 0xd9a520],
          ]),
        )
        .stroke({ color: 0x7a4a00, width: 1.5, join: 'round' })
        .circle(0, -H - 3, 2.6)
        .fill(colors.neon)
        .circle(-10, -H - 1, 2)
        .fill(colors.cyan)
        .circle(10, -H - 1, 2)
        .fill(colors.cyan);
      for (const [x, y] of [
        [-18, -H - 12],
        [0, -H - 16],
        [18, -H - 12],
      ] as const) {
        g.circle(x, y, 2.4).fill(0xfff1a8);
      }
      break;
  }
  return g;
}

/**
 * An arcade cabinet for one game: a dark violet shell with silver bevels and a neon edge, a
 * marquee printed with the game's artwork under chrome lettering and an emblem, a CRT screen
 * running the game's attract loop behind a glass glare, a silver control deck, and the game's
 * artwork across the lower front behind the coin door. The artwork is a texture; everything else
 * is drawn in code. Origin at the bottom centre.
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
  /** Cropped views of the artwork (their textures are this cabinet's to free). */
  private print?: Sprite;
  private band?: Sprite;
  private selected = false;
  private chase = 0;
  private buzz = 0;

  /** `art` is the game's front artwork, loaded up front; without it the panels are plain. */
  constructor(game: GameInfo, art: Texture | null) {
    super();
    this.game = game;
    const { color } = game;

    // Light pool and tube reflections on the floor, under everything else.
    for (let i = 5; i >= 1; i--) {
      this.glow.ellipse(0, 4, 40 + i * 24, 6 + i * 5).fill({ color, alpha: 0.07 });
    }
    for (const x of [-W / 2 - 9, W / 2 + 9]) {
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
          [1, 0x10061f],
        ]),
      )
      // The face around the screen, a shade lighter and inset from the sides.
      .poly([
        -W / 2 + 10,
        -H + 34,
        W / 2 - 10,
        -H + 34,
        W / 2 - 6,
        DECK_TOP - 4,
        -W / 2 + 6,
        DECK_TOP - 4,
      ])
      .fill({ color: 0x4a2478, alpha: 0.3 });

    // Neon along the shell's edge (wide faint glow, brighter halo), with a silver bevel on top.
    this.tube
      .poly(SHELL)
      .stroke({ color, width: 12, alpha: 0.16, join: 'round' })
      .poly(SHELL)
      .stroke({ color, width: 5, alpha: 0.55, join: 'round' })
      // Kick-plate strip.
      .roundRect(-W / 2, -9, W, 3, 1.5)
      .fill({ color, alpha: 0.9 });
    const bevel = new Graphics()
      .poly(SHELL)
      .stroke({ fill: SILVER, width: 2.5, join: 'round' })
      .poly(SHELL)
      .stroke({ color: tubeCore(color), width: 0.8, alpha: 0.6, join: 'round' });

    // The lower front: the game's artwork, cropped to the panel, shaded under the deck lip.
    const lower = new Container();
    if (art) {
      lower.addChild((this.print = cover(art, ART, 0.42)));
    } else {
      lower.addChild(new Graphics().rect(ART.x, ART.y, ART.width, ART.height).fill(0x241040));
    }
    lower.addChild(
      new Graphics()
        .rect(ART.x, ART_TOP, ART.width, 12)
        .fill({ color: 0x05020c, alpha: 0.45 })
        .rect(ART.x, ART_TOP + 12, ART.width, 6)
        .fill({ color: 0x05020c, alpha: 0.2 })
        .rect(ART.x, ART.y, ART.width, ART.height)
        .stroke({ fill: SILVER, width: 2 }),
    );

    // Marquee: a silver-framed lightbox printed with a band of the artwork, under chrome lettering.
    const marquee = new Container();
    const inner = new Rectangle(-W / 2, -H + 4, W, MARQUEE_HEIGHT - 8);
    marquee.addChild(
      new Graphics()
        .roundRect(-W / 2 - 4, -H, W + 8, MARQUEE_HEIGHT, 8)
        .fill(0x07020f)
        .stroke({ fill: SILVER, width: 3 }),
    );
    if (art) marquee.addChild((this.band = cover(art, inner, 0.32)));
    marquee.addChild(
      new Graphics()
        .roundRect(inner.x, inner.y, inner.width, inner.height, 5)
        .fill({ color: 0x0a0418, alpha: art ? 0.45 : 0.9 })
        .roundRect(inner.x, inner.y, inner.width, inner.height, 5)
        .stroke({ color, width: 1.5, alpha: 0.9 }),
    );
    this.marqueeLight
      .roundRect(inner.x, inner.y, inner.width, inner.height, 5)
      .fill({ color, alpha: 0.22 });
    const title = new Text({
      text: game.title,
      style: {
        fontFamily: displayFont,
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 1,
        fill: new FillGradient({
          type: 'linear',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 1 },
          textureSpace: 'local',
          colorStops: [
            { offset: 0, color: '#ffffff' },
            { offset: 0.42, color: tubeCore(color, 0.55) },
            { offset: 0.5, color: 0x2a1a5e },
            { offset: 0.56, color: '#ffffff' },
            { offset: 1, color },
          ],
        }),
        stroke: { color: 0x14052a, width: 4, join: 'round' },
        dropShadow: { color, blur: 6, distance: 0, alpha: 0.9, angle: 0 },
        padding: 12,
      },
    });
    title.anchor.set(0.5);
    title.scale.set(Math.min(1, (W - 34) / title.width));
    title.position.set(0, -H + MARQUEE_HEIGHT / 2);
    const badge = emblem(game.id, title.width);
    const bulbLayer = new Container();
    for (let i = 0; i < BULBS_PER_ROW; i++) {
      const bulb = new Graphics()
        .circle(0, 0, 3)
        .fill(0xffffff)
        .circle(0, 0, 5.5)
        .fill({ color: 0xffffff, alpha: 0.18 });
      bulb.tint = colors.gold;
      bulb.position.set(
        -W / 2 + 10 + (i * (W - 20)) / (BULBS_PER_ROW - 1),
        -H + MARQUEE_HEIGHT + 1,
      );
      this.bulbs.push(bulb);
      bulbLayer.addChild(bulb);
    }

    // Screen: dark bezel with a silver rim and a neon inner line, the attract loop on a tube,
    // then the glass on top.
    const bezel = new Graphics()
      .roundRect(-SCREEN_WIDTH / 2 - 12, SCREEN_TOP - 12, SCREEN_WIDTH + 24, SCREEN_HEIGHT + 24, 12)
      .fill(0x05020c)
      .stroke({ fill: SILVER, width: 2.5 })
      .roundRect(-SCREEN_WIDTH / 2 - 4, SCREEN_TOP - 4, SCREEN_WIDTH + 8, SCREEN_HEIGHT + 8, 9)
      .stroke({ color, width: 1.5, alpha: 0.8 });
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
    this.play.position.set(0, DECK_TOP - 11);
    this.play.alpha = 0.3;

    // Silver control deck with a joystick and two buttons, then the coin door on the artwork.
    const deck = new Graphics()
      .poly([
        -W / 2 - 8,
        DECK_TOP,
        W / 2 + 8,
        DECK_TOP,
        W / 2 + 14,
        DECK_FRONT,
        -W / 2 - 14,
        DECK_FRONT,
      ])
      .fill(
        vertical([
          [0, 0xe9e6f4],
          [0.6, 0x9a95b2],
          [1, 0x5b5675],
        ]),
      )
      .rect(-W / 2 - 14, DECK_FRONT, W + 28, 7)
      .fill(0x1d0f33)
      .moveTo(-W / 2 - 14, DECK_FRONT + 7)
      .lineTo(W / 2 + 14, DECK_FRONT + 7)
      .stroke({ color, width: 1.5, alpha: 0.8 })
      // Joystick: base, shaft, ball and a highlight.
      .ellipse(-52, -153, 11, 4)
      .fill(0x05020c)
      .rect(-53.5, -166, 3, 13)
      .fill(0x4a4560)
      .circle(-52, -168, 7)
      .fill(color)
      .circle(-54.5, -170.5, 2.2)
      .fill({ color: 0xffffff, alpha: 0.7 });
    for (const [x, buttonColor] of [
      [36, colors.neon],
      [62, colors.cyan],
    ] as const) {
      deck
        .ellipse(x, -154, 10, 5)
        .fill(0x05020c)
        .ellipse(x, -157, 9, 4.5)
        .fill(buttonColor)
        .ellipse(x - 2.5, -158.5, 3, 1.4)
        .fill({ color: 0xffffff, alpha: 0.6 });
    }
    const door = new Graphics()
      .roundRect(-28, -70, 56, 50, 5)
      .fill(0x0c0618)
      .stroke({ fill: SILVER, width: 2 })
      .roundRect(-23, -65, 46, 40, 3)
      .stroke({ color: 0x2b1a44, width: 1.5 })
      .roundRect(-9, -34, 18, 5, 2)
      .fill(0x2b1a44);
    for (const x of [-11, 11]) {
      door
        .roundRect(x - 6, -60, 12, 18, 2)
        .fill({ color, alpha: 0.28 })
        .roundRect(x - 1.3, -57, 2.6, 12, 1)
        .fill(tubeCore(color, 0.5));
    }

    this.body.addChild(
      shell,
      lower,
      this.tube,
      bevel,
      marquee,
      this.marqueeLight,
      title,
      badge,
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
    // Bulbs chase along the marquee, faster on the selected cabinet.
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
    // Only the frames: the artwork's source is shared and owned by the asset cache.
    this.print?.texture.destroy(false);
    this.band?.texture.destroy(false);
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

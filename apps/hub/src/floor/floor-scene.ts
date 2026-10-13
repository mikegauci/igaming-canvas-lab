import {
  ACHIEVEMENTS,
  colors,
  Confetti,
  formatCredits,
  Label,
  MuteButton,
  onKey,
  Scene,
  type Achievements,
  type SoundManager,
  type Viewport,
  type Wallet,
} from '@lab/core';
import { gsap } from 'gsap';
import { BitmapText, Container, Graphics, Rectangle, type Texture, type Ticker } from 'pixi.js';
import { Backdrop } from './backdrop';
import { Cabinet, CABINET_HEIGHT } from './cabinet';
import { displayFont } from './fonts';
import { GAMES } from './games';

export interface FloorSceneOptions {
  wallet: Wallet;
  achievements: Achievements;
  sounds: SoundManager;
  coinTexture: Texture;
  /** Plays the short boot animation (first visit of the session). */
  intro: boolean;
  /** Called with the game's path once the zoom-in has covered the screen. */
  navigate: (path: string) => void;
  /** Opens the contact panel (HTML dialog). */
  openContact: () => void;
}

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];
const SWIPE_THRESHOLD = 50;
const SELECTED_KEY = 'lab:floor-selected';

/**
 * The Casino Floor: a neon promenade with one arcade cabinet per game. Nothing to learn: hover
 * or arrow keys pick a cabinet, a click (or Enter) zooms into its screen and opens the game.
 * On phones the row becomes a swipeable carousel. The HUD shows the shared credits and badges,
 * and the HIRE ME sign lights up once every badge is earned.
 */
export class FloorScene extends Scene {
  private readonly options: FloorSceneOptions;
  private readonly backdrop = new Backdrop();
  private readonly world = new Container();
  private readonly cabinets: Cabinet[];
  private readonly title = new Label('iGAMING CANVAS LAB', 'title', {
    fontFamily: displayFont,
    fontSize: 40,
    fontWeight: '900',
    dropShadow: { color: colors.neon, blur: 14, distance: 0, alpha: 0.95 },
  });
  private readonly subtitle = new Label('THE CASINO FLOOR', 'caption', {
    fontFamily: displayFont,
    fontWeight: '500',
    letterSpacing: 6,
  });
  private readonly caption = new Label('', 'body', { fontSize: 20 });
  private readonly hint = new Label('', 'caption');
  private readonly credits: BitmapText;
  private readonly badges = new Container();
  private readonly hireMe = new Container();
  private readonly hireMeSign: Graphics;
  private readonly hireMeText: Label;
  private readonly mute: MuteButton;
  private readonly dots = new Graphics();
  private readonly confetti: Confetti;
  private readonly curtain = new Graphics();
  private readonly introLayer = new Container();
  private viewport: Viewport = { width: 1280, height: 720, orientation: 'landscape' };
  private selected = 0;
  private cameraX = 0;
  private cameraTarget = 0;
  /** Extra camera offset while a finger drags the carousel. */
  private dragOffset = 0;
  private dragStartX: number | null = null;
  /** How far the last gesture travelled, so a swipe that ends on a cabinet isn't a tap. */
  private lastDragDistance = 0;
  private introActive = false;
  private pointerParallax = 0;
  private time = 0;
  private launching = false;
  private keyBindings: (() => void)[] = [];
  private konamiProgress = 0;
  private readonly onKonamiKey = (event: KeyboardEvent) => this.trackKonami(event);
  private readonly onWheel = (event: WheelEvent) => this.scrollSelect(event);
  private wheelLock = 0;

  constructor(options: FloorSceneOptions) {
    super();
    this.options = options;
    const { wallet, achievements, sounds, coinTexture } = options;

    this.cabinets = GAMES.map((game, i) => {
      const cabinet = new Cabinet(game);
      cabinet.onSelect = () => this.select(i);
      cabinet.onPlay = () => this.activate(i);
      return cabinet;
    });
    this.world.addChild(...this.cabinets);

    this.title.anchor.set(0.5);
    this.subtitle.anchor.set(0.5);
    this.caption.anchor.set(0.5);
    this.hint.anchor.set(0.5);
    this.credits = new BitmapText({
      text: '',
      style: { fontFamily: displayFont, fontSize: 20, fontWeight: '700', fill: colors.gold },
    });
    this.credits.anchor.set(0, 0.5);
    const renderCredits = () => (this.credits.text = `CREDITS ${formatCredits(wallet.balance)}`);
    renderCredits();
    wallet.onChange(renderCredits);

    this.buildBadges(achievements);
    this.hireMeSign = new Graphics();
    this.hireMeText = new Label('HIRE ME', 'body', {
      fontFamily: displayFont,
      fontSize: 22,
      fontWeight: '900',
      fill: colors.neon,
      letterSpacing: 4,
    });
    this.hireMeText.anchor.set(0.5);
    this.hireMe.addChild(this.hireMeSign, this.hireMeText);
    this.drawHireMe();
    this.hireMe.eventMode = 'static';
    this.hireMe.cursor = 'pointer';
    this.hireMe.accessible = true;
    this.hireMe.accessibleType = 'button';
    this.hireMe.accessibleTitle = 'Hire me: contact details';
    this.hireMe.on('pointertap', () => options.openContact());
    achievements.onChange(() => this.drawHireMe());

    this.mute = new MuteButton(sounds, 48);
    this.confetti = new Confetti(260, coinTexture);

    // Full-screen hit area so swipes work anywhere, not just on a cabinet.
    this.eventMode = 'static';
    this.on('pointerdown', (e) => {
      this.dragStartX = e.global.x;
      this.lastDragDistance = 0;
    });
    this.on('pointermove', (e) => this.drag(e.global.x));
    this.on('pointerup', () => this.endDrag());
    this.on('pointerupoutside', () => this.endDrag());
    this.on('pointerleave', () => (this.pointerParallax = 0));
    this.on('globalpointermove', (e) => {
      if (this.viewport.orientation === 'landscape') {
        this.pointerParallax = (this.toLocal(e.global).x / this.viewport.width - 0.5) * 60;
      }
    });

    this.curtain.alpha = 0;
    // Decorative layers must not take part in hit-testing: inside an interactive parent even a
    // transparent full-screen Graphics (the fade curtain) would swallow every click.
    for (const layer of [this.backdrop, this.curtain, this.confetti, this.dots]) {
      layer.eventMode = 'none';
    }
    this.addChild(
      this.backdrop,
      this.world,
      this.title,
      this.subtitle,
      this.credits,
      this.badges,
      this.hireMe,
      this.mute,
      this.caption,
      this.hint,
      this.dots,
      this.confetti,
      this.curtain,
      this.introLayer,
    );

    const saved = Number(sessionStorage.getItem(SELECTED_KEY));
    this.selected = Number.isInteger(saved) && saved >= 0 && saved < GAMES.length ? saved : 0;
    this.cabinets[this.selected]!.setSelected(true);
    this.renderCaption();
    if (options.intro) this.playIntro();
  }

  override resize(viewport: Viewport): void {
    this.viewport = viewport;
    const { width, height, orientation } = viewport;
    this.hitArea = new Rectangle(0, 0, width, height);
    this.curtain.clear().rect(0, 0, width, height).fill(colors.bg);

    if (orientation === 'landscape') {
      const street = 470;
      this.backdrop.build(width, height, 380, street, 120);
      const spacing = 236;
      const left = width / 2 - spacing * 2;
      this.cabinets.forEach((cabinet, i) => {
        cabinet.scale.set(1);
        cabinet.position.set(left + i * spacing, street + 150);
      });
      this.title.position.set(width / 2, 52);
      this.subtitle.position.set(width / 2, 92);
      this.credits.position.set(28, 36);
      this.badges.position.set(30, 76);
      this.hireMe.position.set(width - 160, 44);
      this.mute.position.set(width - 44, 44);
      this.caption.position.set(width / 2, height - 46);
      this.hint.position.set(width / 2, height - 18);
      this.hint.text = 'HOVER TO PREVIEW · CLICK TO PLAY · ← → TO BROWSE';
      this.dots.clear();
    } else {
      const street = 720;
      const spacing = 380;
      this.backdrop.build(width, height, 600, street, spacing * (GAMES.length - 1));
      this.cabinets.forEach((cabinet, i) => {
        cabinet.scale.set(1.5);
        cabinet.position.set(width / 2 + i * spacing, street + 150 + CABINET_HEIGHT * 0.5);
      });
      this.title.position.set(width / 2, 70);
      this.subtitle.position.set(width / 2, 112);
      this.credits.position.set(28, 168);
      this.badges.position.set(30, 206);
      this.hireMe.position.set(width - 130, 186);
      this.mute.position.set(width - 44, 254);
      this.caption.position.set(width / 2, height - 150);
      this.hint.position.set(width / 2, height - 112);
      this.hint.text = 'SWIPE TO BROWSE · TAP TO PLAY';
    }
    this.cameraTarget = this.targetFor(this.selected);
    this.cameraX = this.cameraTarget;
    this.applyCamera();
    this.renderCaption();
  }

  override enter(): void {
    this.exit();
    this.keyBindings = [
      onKey('ArrowLeft', () => this.select(this.selected - 1)),
      onKey('ArrowRight', () => this.select(this.selected + 1)),
      onKey(['Enter', 'Space'], () => this.activate(this.selected)),
    ];
    window.addEventListener('keydown', this.onKonamiKey);
    window.addEventListener('wheel', this.onWheel, { passive: true });
  }

  override exit(): void {
    this.keyBindings.forEach((unbind) => unbind());
    this.keyBindings = [];
    window.removeEventListener('keydown', this.onKonamiKey);
    window.removeEventListener('wheel', this.onWheel);
  }

  override destroy(...args: Parameters<Scene['destroy']>): void {
    this.exit();
    gsap.killTweensOf([this, this.curtain, this.introLayer, this.world, this.world.scale]);
    super.destroy(...args);
  }

  override update(ticker: Ticker): void {
    const seconds = ticker.deltaMS / 1000;
    this.time += seconds;
    for (const cabinet of this.cabinets) cabinet.update(seconds, this.time);
    this.backdrop.update(seconds);
    this.confetti.tick(seconds);

    // Ease the camera; in landscape it also drifts a little with the pointer for depth.
    const target = this.cameraTarget + this.dragOffset + this.pointerParallax;
    this.cameraX += (target - this.cameraX) * Math.min(1, seconds * 6);
    this.applyCamera();

    if (this.achievementsComplete) {
      this.hireMeText.alpha =
        0.85 + Math.sin(this.time * 19) * 0.1 + Math.sin(this.time * 5) * 0.05;
    }
  }

  private get achievementsComplete(): boolean {
    return this.options.achievements.complete;
  }

  private select(index: number) {
    if (this.launching || this.introActive) return;
    const next = (index + GAMES.length) % GAMES.length;
    if (next === this.selected) return;
    this.cabinets[this.selected]!.setSelected(false);
    this.selected = next;
    this.cabinets[next]!.setSelected(true);
    this.cameraTarget = this.targetFor(next);
    this.options.sounds.play('chime');
    sessionStorage.setItem(SELECTED_KEY, String(next));
    this.renderCaption();
  }

  /** Click on a cabinet: on phones the first tap on a side cabinet only brings it to centre. */
  private activate(index: number) {
    if (this.launching || this.introActive || this.lastDragDistance > 12) return;
    if (this.viewport.orientation === 'portrait' && index !== this.selected) {
      this.select(index);
      return;
    }
    this.select(index);
    this.launch(index);
  }

  /** Zooms into the cabinet's screen, fades out and opens the game. */
  private launch(index: number) {
    this.launching = true;
    const cabinet = this.cabinets[index]!;
    const game = GAMES[index]!;
    this.options.sounds.play('zoom');
    sessionStorage.setItem(SELECTED_KEY, String(index));

    const focus = this.toLocal(cabinet.screenCenter);
    const zoom = 5;
    const { width, height } = this.viewport;
    gsap
      .timeline({ onComplete: () => this.options.navigate(game.path) })
      .to(this.world.scale, { x: zoom, y: zoom, duration: 0.55, ease: 'power3.in' }, 0)
      .to(
        this.world,
        {
          x: width / 2 - (focus.x - this.world.x) * zoom,
          y: height / 2 - (focus.y - this.world.y) * zoom,
          duration: 0.55,
          ease: 'power3.in',
        },
        0,
      )
      .to(this.curtain, { alpha: 1, duration: 0.25 }, 0.35);
  }

  private targetFor(index: number): number {
    if (this.viewport.orientation === 'landscape') return 0;
    return index * 380;
  }

  private applyCamera() {
    if (!this.launching) this.world.x = -this.cameraX;
    this.backdrop.setCamera(this.cameraX);
    this.drawDots();
  }

  private drag(x: number) {
    if (this.dragStartX === null || this.viewport.orientation !== 'portrait') return;
    this.dragOffset = (this.dragStartX - x) / this.root.scale.x;
  }

  private endDrag() {
    this.lastDragDistance = Math.abs(this.dragOffset);
    if (this.dragStartX !== null && Math.abs(this.dragOffset) > SWIPE_THRESHOLD) {
      this.select(this.selected + Math.sign(this.dragOffset));
    }
    this.dragStartX = null;
    this.dragOffset = 0;
  }

  private get root(): Container {
    return this.parent ?? this;
  }

  private scrollSelect(event: WheelEvent) {
    const now = performance.now();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (now < this.wheelLock || Math.abs(delta) < 8) return;
    this.wheelLock = now + 280;
    this.select(this.selected + Math.sign(delta));
  }

  private renderCaption() {
    this.caption.text = GAMES[this.selected]!.caption;
  }

  private drawDots() {
    if (this.viewport.orientation !== 'portrait') return;
    const { width, height } = this.viewport;
    this.dots.clear();
    GAMES.forEach((game, i) => {
      const x = width / 2 + (i - (GAMES.length - 1) / 2) * 26;
      this.dots.circle(x, height - 190, i === this.selected ? 7 : 5).fill({
        color: i === this.selected ? game.color : colors.muted,
        alpha: i === this.selected ? 1 : 0.5,
      });
    });
  }

  private buildBadges(achievements: Achievements) {
    const draw = () => {
      this.badges.removeChildren().forEach((child) => child.destroy());
      ACHIEVEMENTS.forEach((badge, i) => {
        const game = GAMES.find((g) => g.badge === badge.id)!;
        const earned = achievements.has(badge.id);
        const icon = new Graphics().circle(0, 0, 13);
        if (earned) icon.fill(game.color).circle(0, 0, 13).stroke({ color: 0xffffff, width: 2 });
        else icon.stroke({ color: game.color, width: 2, alpha: 0.6 });
        icon.star(0, 0, 5, 7, 3).fill(earned ? colors.bg : { color: game.color, alpha: 0.4 });
        icon.position.set(13 + i * 34, 0);
        icon.eventMode = 'static';
        icon.cursor = 'help';
        icon.accessible = true;
        icon.accessibleTitle = `${badge.title}: ${earned ? 'earned' : badge.hint}`;
        icon.on('pointerover', () => {
          this.caption.text = `BADGE · ${badge.title} — ${earned ? 'earned!' : badge.hint}`;
        });
        icon.on('pointerout', () => this.renderCaption());
        this.badges.addChild(icon);
      });
    };
    draw();
    achievements.onChange(draw);
  }

  private drawHireMe() {
    const lit = this.achievementsComplete;
    this.hireMeSign
      .clear()
      .roundRect(-78, -24, 156, 48, 14)
      .fill({ color: colors.bg, alpha: 0.85 })
      .stroke({ color: colors.neon, width: 3, alpha: lit ? 1 : 0.35 });
    this.hireMeText.alpha = lit ? 1 : 0.35;
    this.hireMeText.style.dropShadow = lit
      ? { color: colors.neon, blur: 14, distance: 0, alpha: 1, angle: 0 }
      : false;
  }

  private trackKonami(event: KeyboardEvent) {
    this.konamiProgress = event.code === KONAMI[this.konamiProgress] ? this.konamiProgress + 1 : 0;
    if (event.code === KONAMI[0] && this.konamiProgress === 0) this.konamiProgress = 1;
    if (this.konamiProgress < KONAMI.length) return;
    this.konamiProgress = 0;
    this.options.sounds.play('coin');
    const { width } = this.viewport;
    for (let i = 0; i < 5; i++) {
      this.confetti.burst({
        x: (width / 6) * (i + 1),
        y: -20,
        count: 40,
        angle: Math.PI / 2,
        spread: 1.2,
        speed: [100, 500],
        size: 30,
        aspect: 1,
        spin: 0,
        flip: 'x',
        gravity: 700,
        life: 3,
        palette: [0xffffff],
      });
    }
  }

  /** "INSERT COIN" boot: under 1.5 s, skippable with any key or tap. */
  private playIntro() {
    const { introLayer } = this;
    const bg = new Graphics().rect(0, 0, 4000, 4000).fill(colors.bg);
    const insert = new Label('INSERT COIN', 'title', {
      fontFamily: displayFont,
      fill: colors.gold,
      letterSpacing: 6,
    });
    const start = new Label('PRESS START', 'title', {
      fontFamily: displayFont,
      fill: colors.neon,
      letterSpacing: 6,
      dropShadow: { color: colors.neon, blur: 16, distance: 0, alpha: 1 },
    });
    insert.anchor.set(0.5);
    start.anchor.set(0.5);
    start.alpha = 0;
    introLayer.addChild(bg, insert, start);
    introLayer.eventMode = 'static';
    this.introActive = true;

    const place = () => {
      const { width, height } = this.viewport;
      insert.position.set(width / 2, height / 2);
      start.position.set(width / 2, height / 2);
    };
    place();

    const finish = () => {
      if (introLayer.destroyed || !this.introActive) return;
      this.introActive = false;
      tl.kill();
      window.removeEventListener('keydown', finish);
      gsap.to(introLayer, {
        alpha: 0,
        duration: 0.25,
        onComplete: () => introLayer.destroy({ children: true }),
      });
    };
    const tl = gsap
      .timeline({ onComplete: finish })
      .call(place)
      .to(insert, { alpha: 0.2, duration: 0.12, yoyo: true, repeat: 3 })
      .call(() => this.options.sounds.play('coin'))
      .to(insert, { alpha: 0, duration: 0.1 })
      .to(start, { alpha: 1, duration: 0.1 })
      .to(start.scale, { x: 1.15, y: 1.15, duration: 0.25, yoyo: true, repeat: 1 });
    introLayer.on('pointertap', finish);
    window.addEventListener('keydown', finish, { once: true });
  }
}

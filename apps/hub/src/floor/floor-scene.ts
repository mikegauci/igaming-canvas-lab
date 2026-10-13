import {
  ACHIEVEMENTS,
  colors,
  Confetti,
  formatCredits,
  Label,
  onKey,
  Scene,
  type Achievements,
  type SoundManager,
  type Viewport,
  type Wallet,
} from '@lab/core';
import { gsap } from 'gsap';
import { Container, Graphics, Rectangle, Text, type Texture, type Ticker } from 'pixi.js';
import { Backdrop } from './backdrop';
import { BadgeTip } from './badge-tip';
import { Cabinet, CABINET_HEIGHT } from './cabinet';
import { CrtFilter } from './crt-filter';
import { Motes } from './motes';
import { GAMES, type GameInfo } from './games';
import { NeonIconButton, pulseGlyph, speakerGlyph } from './icon-button';
import { NeonTitle, neonStyle, strike } from './neon';
import type { Quality, QualitySettings } from './quality';

export interface FloorSceneOptions {
  wallet: Wallet;
  achievements: Achievements;
  sounds: SoundManager;
  coinTexture: Texture;
  /** Each cabinet's front artwork, preloaded; a missing one leaves that cabinet's panels plain. */
  cabinetArt: Partial<Record<GameInfo['id'], Texture>>;
  /** Soft glow dot for the drifting motes. */
  moteTexture: Texture;
  /** Turns the cabinets' CRT pass on or off with the quality tier. */
  quality: Quality;
  /** Shows the short boot animation (first visit of the session); it runs on startIntro(). */
  intro: boolean;
  /** Called with the game's path once the zoom-in has covered the screen. */
  navigate: (path: string) => void;
  /** The stats panel (FPS, draw calls, quality tier): the HUD's pulse button toggles it. */
  stats: { on: boolean };
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
/** Portrait layout: where the carousel dots sit, and the bottom of the HUD (title, badges). */
const DOTS_FROM_BOTTOM = 190;
const HUD_BOTTOM = 260;

/**
 * The Casino Floor: a synthwave arcade with one cabinet per game. Nothing to learn: hover
 * or arrow keys pick a cabinet, a click (or Enter) zooms into its screen and opens the game.
 * On phones the row becomes a swipeable carousel. The HUD shows the shared credits and badges
 * (hover one for how to earn it), with a message once every badge is earned.
 */
export class FloorScene extends Scene {
  private readonly options: FloorSceneOptions;
  private readonly backdrop = new Backdrop();
  private readonly world = new Container();
  private readonly cabinets: Cabinet[];
  private readonly title = new NeonTitle();
  private readonly caption = new Label('', 'body', { fontSize: 20 });
  private readonly hint = new Label('', 'caption');
  private readonly credits: Text;
  private readonly badges = new Container();
  private readonly badgeTip = new BadgeTip();
  private readonly badgesDone: Text;
  private readonly statsButton: NeonIconButton;
  private readonly mute: NeonIconButton;
  private readonly dots = new Graphics();
  private readonly confetti: Confetti;
  private readonly crt = new CrtFilter();
  private readonly motes: Motes;
  private readonly curtain = new Graphics();
  /** The switch-off flash when a game launches: the picture collapses to a line, then a dot. */
  private readonly flash = new Graphics();
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
  private introTimeline?: gsap.core.Timeline;
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
      const cabinet = new Cabinet(game, options.cabinetArt[game.id] ?? null);
      cabinet.onSelect = () => this.select(i);
      cabinet.onPlay = () => this.activate(i);
      return cabinet;
    });
    this.world.addChild(...this.cabinets);
    this.motes = new Motes(options.moteTexture);
    const applyQuality = ({ crt, particles }: QualitySettings) => {
      for (const cabinet of this.cabinets) cabinet.crt = crt ? this.crt : null;
      this.motes.setDensity(particles);
    };
    applyQuality(options.quality.settings);
    options.quality.onChange(applyQuality);

    this.caption.anchor.set(0.5);
    this.hint.anchor.set(0.5);
    this.credits = new Text({ text: '', style: neonStyle(colors.gold, 18, { letterSpacing: 1 }) });
    this.credits.anchor.set(0, 0.5);
    const renderCredits = () => (this.credits.text = `CREDITS ${formatCredits(wallet.balance)}`);
    renderCredits();
    wallet.onChange(renderCredits);

    this.badgesDone = new Text({
      text: '★ ALL BADGES COLLECTED · THANKS FOR PLAYING ★',
      style: neonStyle(0x7cff6b, 12, { letterSpacing: 1 }),
    });
    this.badgesDone.anchor.set(0, 0.5);
    this.buildBadges(achievements);
    this.statsButton = new NeonIconButton(pulseGlyph, colors.cyan, (on) =>
      on ? 'Hide performance stats' : 'Show performance stats',
    );
    this.statsButton.lit = options.stats.on;
    this.statsButton.on('pointertap', () => {
      options.stats.on = !options.stats.on;
      this.statsButton.lit = options.stats.on;
    });
    this.mute = new NeonIconButton(speakerGlyph, colors.cyan, (on) =>
      on ? 'Mute sound' : 'Unmute sound',
    );
    this.mute.lit = !sounds.muted;
    this.mute.on('pointertap', () => sounds.toggle());
    sounds.onChange(() => (this.mute.lit = !sounds.muted));
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
    const decorative = [
      this.backdrop,
      this.motes,
      this.curtain,
      this.flash,
      this.confetti,
      this.dots,
    ];
    for (const layer of decorative) {
      layer.eventMode = 'none';
    }
    this.addChild(
      this.backdrop,
      this.motes,
      this.world,
      this.title,
      this.credits,
      this.badges,
      this.badgesDone,
      this.statsButton,
      this.mute,
      this.caption,
      this.hint,
      this.dots,
      this.badgeTip,
      this.confetti,
      this.curtain,
      this.flash,
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
    this.curtain
      .clear()
      .rect(-1000, -1000, width + 2000, height + 2000)
      .fill(0x000000);
    this.flash
      .clear()
      .rect(-width / 2, -height / 2, width, height)
      .fill(0xf4f1ff);
    this.flash.position.set(width / 2, height / 2);
    this.flash.alpha = 0;
    this.motes.layout(width, height);

    if (orientation === 'landscape') {
      const ground = 620;
      this.backdrop.build(width, height, 380, ground, 120);
      const spacing = 236;
      const left = width / 2 - spacing * 2;
      this.cabinets.forEach((cabinet, i) => {
        cabinet.scale.set(1);
        cabinet.position.set(left + i * spacing, ground);
      });
      this.title.layout(1);
      this.title.position.set(width / 2, 56);
      this.credits.position.set(28, 36);
      this.badges.position.set(30, 76);
      this.placeBadgeExtras();
      this.statsButton.position.set(width - 100, 44);
      this.mute.position.set(width - 44, 44);
      this.caption.position.set(width / 2, height - 46);
      this.hint.position.set(width / 2, height - 18);
      this.hint.text = 'HOVER TO PREVIEW · CLICK TO PLAY · ← → TO BROWSE';
      this.dots.clear();
    } else {
      // The cabinets stand just above the carousel dots, but never so low on a short screen
      // that their marquees run into the HUD.
      const scale = 1.5;
      const ground = Math.max(HUD_BOTTOM + CABINET_HEIGHT * scale, height - DOTS_FROM_BOTTOM - 50);
      const spacing = 380;
      this.backdrop.build(width, height, 600, ground, spacing * (GAMES.length - 1));
      this.cabinets.forEach((cabinet, i) => {
        cabinet.scale.set(scale);
        cabinet.position.set(width / 2 + i * spacing, ground);
      });
      this.title.layout(0.74);
      this.title.position.set(width / 2, 72);
      this.credits.position.set(28, 168);
      this.badges.position.set(30, 206);
      this.placeBadgeExtras();
      this.statsButton.position.set(width - 100, 186);
      this.mute.position.set(width - 44, 186);
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
    this.introTimeline?.kill();
    gsap.killTweensOf([this, this.curtain, this.flash, this.flash.scale, this.introLayer]);
    gsap.killTweensOf([this.world, this.world.scale]);
    super.destroy(...args);
    this.crt.destroy();
  }

  override update(ticker: Ticker): void {
    const seconds = ticker.deltaMS / 1000;
    this.time += seconds;
    for (const cabinet of this.cabinets) cabinet.update(seconds);
    this.crt.time = this.time;
    this.backdrop.update(seconds);
    this.motes.tick(seconds);
    this.title.update(seconds);
    this.confetti.tick(seconds);

    // Ease the camera; in landscape it also drifts a little with the pointer for depth.
    const target = this.cameraTarget + this.dragOffset + this.pointerParallax;
    this.cameraX += (target - this.cameraX) * Math.min(1, seconds * 6);
    this.applyCamera();
  }

  /** Runs the boot animation set up in the constructor, if there is one. */
  startIntro(): void {
    // A key pressed during loading may already have skipped it.
    if (this.introActive) this.introTimeline?.play();
    else this.title.shine();
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

  /** Zooms into the cabinet's screen, switches it off like a CRT and opens the game. */
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
      // Then the tube switches off: a white frame collapses to a line, then to a dot.
      .call(() => this.options.sounds.play('off'), undefined, 0.5)
      .set(this.curtain, { alpha: 1 }, 0.55)
      .set(this.flash, { alpha: 1 }, 0.55)
      .to(this.flash.scale, { y: 0.006, duration: 0.12, ease: 'power2.in' }, 0.55)
      .to(this.flash.scale, { x: 0, duration: 0.16, ease: 'power3.in' }, 0.67)
      .to(this.flash, { alpha: 0, duration: 0.06 }, 0.8);
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
      this.dots.circle(x, height - DOTS_FROM_BOTTOM, i === this.selected ? 7 : 5).fill({
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
          icon.scale.set(1.15);
          this.badgeTip.show({
            game: game.title,
            title: badge.title,
            hint: badge.hint,
            earned,
            color: game.color,
            progress: [achievements.count, ACHIEVEMENTS.length],
          });
        });
        icon.on('pointerout', () => {
          icon.scale.set(1);
          this.badgeTip.hide();
        });
        this.badges.addChild(icon);
      });
      this.badgeTip.hide();
      this.badgesDone.visible = achievements.complete;
    };
    draw();
    achievements.onChange(draw);
  }

  /** The "all collected" line and the hover card sit just under the badge row. */
  private placeBadgeExtras() {
    const { x, y } = this.badges.position;
    this.badgesDone.position.set(x, y + 30);
    this.badgeTip.position.set(x - 2, y + 20);
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

  /**
   * Power-on boot: the screen fades up on the horizon, the chrome title drops in, the neon script
   * strikes with a buzz, the cabinets light up one by one and the HUD comes on. Under 2 s,
   * skippable with any key or tap. Paused until startIntro().
   */
  private playIntro() {
    const { introLayer, title, cabinets } = this;
    const { sounds } = this.options;
    const black = new Graphics().rect(-2000, -2000, 6000, 6000).fill(0x000000);
    introLayer.addChild(black);
    introLayer.eventMode = 'static';
    this.introActive = true;

    const hud = [
      this.credits,
      this.badges,
      this.badgesDone,
      this.statsButton,
      this.mute,
      this.caption,
      this.hint,
      this.dots,
    ];
    for (const target of [title.chrome, title.script, ...cabinets, ...hud]) target.alpha = 0;

    const finish = () => {
      if (introLayer.destroyed || !this.introActive) return;
      this.introActive = false;
      window.removeEventListener('keydown', finish);
      // Skipping jumps to the end state, so nothing is left half-lit.
      tl.progress(1).kill();
      introLayer.destroy({ children: true });
    };
    const tl = gsap
      .timeline({ paused: true, onComplete: finish })
      .to(black, { alpha: 0, duration: 0.6, ease: 'power2.out' }, 0)
      .fromTo(
        title.chrome,
        { alpha: 0, y: -50 },
        { alpha: 1, y: 0, duration: 0.5, ease: 'back.out(2)' },
        0.25,
      )
      .call(() => title.shine(), undefined, 0.75)
      .call(() => sounds.play('buzz'), undefined, 0.8);
    strike(tl, title.script, 0.8);
    cabinets.forEach((cabinet, i) => {
      const at = 1.15 + i * 0.1;
      tl.call(() => sounds.play('blip'), undefined, at);
      strike(tl, cabinet, at);
    });
    tl.to(hud, { alpha: 1, duration: 0.3 }, 1.75);
    this.introTimeline = tl;
    introLayer.on('pointertap', finish);
    window.addEventListener('keydown', finish, { once: true });
  }
}

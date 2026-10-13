import { Achievements, colors, createGame, sessionStore, SoundManager, Wallet } from '@lab/core';
import { Assets, Container, Graphics, Rectangle, type Texture } from 'pixi.js';
import { FloorScene } from './floor-scene';
import { loadFonts } from './fonts';
import { GAMES, type GameInfo } from './games';
import { PostEffects } from './post';
import { Quality } from './quality';

const INTRO_KEY = 'lab:intro-seen';

export interface FloorHandle {
  /** Plays the boot animation, if this visit has one; call once the floor is on screen. */
  startIntro(): void;
  /**
   * True when the floor should wait behind an enter button: this visit plays the intro, and the
   * browser holds audio until a tap. The tap on that button starts the music and intro sounds.
   */
  needsEnter: boolean;
}

/**
 * Boots Pixi and the Casino Floor into `parent`. Loaded on demand. `onProgress` reports the share
 * (0 to 1) of the boot work done so far: Pixi, the fonts and each cabinet's artwork. It reaches 1
 * just before the scene is built.
 */
export async function startFloor(
  parent: HTMLElement,
  onProgress?: (done: number) => void,
): Promise<FloorHandle> {
  const steps = GAMES.length + 2;
  let done = 0;
  const step = <T>(value: T): T => {
    onProgress?.(++done / steps);
    return value;
  };
  const quality = Quality.fromEnvironment();
  // Post-processing needs the app, so the debug panel asks for its state through this.
  let describePost = () => 'post pending';
  const [game, cabinetArt] = await Promise.all([
    createGame({
      parent,
      designWidth: 1280,
      designHeight: 720,
      portrait: { width: 720, height: 1280 },
      maxResolution: quality.settings.maxResolution,
      debugInfo: () => `quality ${quality.tier} · ${describePost()}`,
    }).then(step),
    loadCabinetArt(() => step(undefined)),
    loadFonts().then(step),
  ]);
  // elapsedMS is the raw frame time (deltaMS is clamped); hidden tabs are throttled, not slow.
  game.app.ticker.add((ticker) => {
    if (!document.hidden) quality.sample(ticker.elapsedMS);
  });
  const post = new PostEffects(game.app);
  describePost = () => post.describe();
  post.apply(quality.settings);
  quality.onChange((settings) => {
    const { renderer, screen } = game.app;
    const resolution = Math.min(window.devicePixelRatio, settings.maxResolution);
    renderer.resize(screen.width, screen.height, resolution);
    post.apply(settings);
  });

  // The stats panel follows the pulse button; the game remembers the choice across visits.
  const stats = {
    get on() {
      return game.debug;
    },
    set on(value: boolean) {
      game.debug = value;
    },
  };

  const sounds = new SoundManager();
  sounds.synth({
    chime: [
      { freq: 1319, duration: 0.12, wave: 'sine', volume: 0.12 },
      { freq: 1760, duration: 0.18, delay: 0.05, wave: 'sine', volume: 0.08 },
    ],
    coin: [
      { freq: 988, duration: 0.08, wave: 'square', volume: 0.12 },
      { freq: 1319, duration: 0.25, delay: 0.07, wave: 'square', volume: 0.12 },
    ],
    zoom: [{ freq: 200, to: 1200, duration: 0.5, wave: 'triangle', volume: 0.18 }],
    // A CRT switching off: a falling whine and a click.
    off: [
      { freq: 1800, to: 300, duration: 0.18, wave: 'sine', volume: 0.08 },
      { freq: 0, duration: 0.03, delay: 0.16, wave: 'noise', volume: 0.08 },
    ],
    // Neon tube striking: a mains hum with a crackle.
    buzz: [
      { freq: 100, duration: 0.45, wave: 'saw', volume: 0.05 },
      { freq: 0, duration: 0.08, delay: 0.05, wave: 'noise', volume: 0.04 },
      { freq: 0, duration: 0.05, delay: 0.25, wave: 'noise', volume: 0.03 },
    ],
    blip: [{ freq: 660, to: 990, duration: 0.05, wave: 'square', volume: 0.04 }],
  });

  const coinArt = new Container({
    children: [
      new Graphics()
        .circle(0, 0, 22)
        .fill(colors.gold)
        .stroke({ color: 0xb8901a, width: 4 })
        .star(0, 0, 5, 9, 4)
        .fill(0xfff1a8),
    ],
  });
  const coinTexture = game.app.renderer.generateTexture({
    target: coinArt,
    frame: new Rectangle(-24, -24, 48, 48),
    resolution: game.app.renderer.resolution,
  });
  coinArt.destroy({ children: true });

  // A soft round glow for the drifting motes: rings that fade toward the edge.
  const moteArt = new Graphics();
  for (let r = 8; r >= 1; r--) moteArt.circle(0, 0, r).fill({ color: 0xffffff, alpha: 0.12 });
  moteArt.circle(0, 0, 1.6).fill(0xffffff);
  const moteTexture = game.app.renderer.generateTexture({
    target: moteArt,
    frame: new Rectangle(-8, -8, 16, 16),
    resolution: game.app.renderer.resolution,
  });
  moteArt.destroy();

  const session = sessionStore();
  const intro = session.get(INTRO_KEY) === null;
  session.set(INTRO_KEY, '1');

  const scene = new FloorScene({
    wallet: new Wallet(),
    achievements: new Achievements(),
    sounds,
    coinTexture,
    moteTexture,
    cabinetArt,
    intro,
    quality,
    navigate: (path) => window.location.assign(path),
    stats,
  });
  // Coming back with the browser's back button can restore this page from its cache, frozen
  // mid-zoom and with stale credits and badges: reload to pick up what changed in the game.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
  await game.scenes.change(scene, { fade: intro ? 0 : 0.3 });

  const anyAudio = !sounds.muted || !sounds.musicMuted;
  return {
    startIntro: () => scene.startIntro(),
    needsEnter: intro && anyAudio && !(await sounds.canPlayWithoutGesture()),
  };
}

/**
 * Loads every cabinet's front artwork once, before the cabinets are built, calling `onLoaded` as
 * each one settles. The prints are scaled well down on screen, so they get mipmaps (asked for at
 * load: the source sizes its mip chain when it's created). Artwork that fails to load is left
 * out: that cabinet is drawn with plain panels rather than holding up the floor.
 */
async function loadCabinetArt(
  onLoaded: () => void,
): Promise<Partial<Record<GameInfo['id'], Texture>>> {
  const entries = await Promise.all(
    GAMES.map(async ({ id, art }) => {
      try {
        const texture = await Assets.load<Texture>({
          src: art,
          data: { autoGenerateMipmaps: true },
        });
        return [id, texture] as const;
      } catch {
        return [id, undefined] as const;
      } finally {
        onLoaded();
      }
    }),
  );
  return Object.fromEntries(entries.filter(([, texture]) => texture));
}

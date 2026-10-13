import { Achievements, colors, createGame, SoundManager, Wallet } from '@lab/core';
import { Container, Graphics, Rectangle } from 'pixi.js';
import { FloorScene } from './floor-scene';
import { loadFonts } from './fonts';
import { Quality } from './quality';

const INTRO_KEY = 'lab:intro-seen';

export interface FloorHandle {
  /** Plays the boot animation, if this visit has one; call once the floor is on screen. */
  startIntro(): void;
}

/**
 * Boots Pixi and the Casino Floor into `parent`. Loaded on demand. `onBooted` fires once Pixi and
 * the fonts are ready, before the scene is built.
 */
export async function startFloor(
  parent: HTMLElement,
  openContact: () => void,
  onBooted?: () => void,
): Promise<FloorHandle> {
  const quality = Quality.fromEnvironment();
  const [game] = await Promise.all([
    createGame({
      parent,
      designWidth: 1280,
      designHeight: 720,
      portrait: { width: 720, height: 1280 },
      maxResolution: quality.settings.maxResolution,
      debugInfo: () => `quality ${quality.tier}`,
    }),
    loadFonts(),
  ]);
  onBooted?.();
  // elapsedMS is the raw frame time (deltaMS is clamped); hidden tabs are throttled, not slow.
  game.app.ticker.add((ticker) => {
    if (!document.hidden) quality.sample(ticker.elapsedMS);
  });
  quality.onChange(({ maxResolution }) => {
    const { renderer, screen } = game.app;
    renderer.resize(screen.width, screen.height, Math.min(window.devicePixelRatio, maxResolution));
  });

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

  const intro = sessionStorage.getItem(INTRO_KEY) === null;
  sessionStorage.setItem(INTRO_KEY, '1');

  const scene = new FloorScene({
    wallet: new Wallet(),
    achievements: new Achievements(),
    sounds,
    coinTexture,
    intro,
    quality,
    navigate: (path) => window.location.assign(path),
    openContact,
  });
  // Coming back with the browser's back button can restore this page from its cache, frozen
  // mid-zoom and with stale credits and badges: reload to pick up what changed in the game.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
  await game.scenes.change(scene, { fade: intro ? 0 : 0.3 });

  return {
    startIntro: () => scene.startIntro(),
  };
}

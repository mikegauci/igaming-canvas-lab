import { Achievements, colors, createGame, SoundManager, Wallet } from '@lab/core';
import { Container, Graphics, Rectangle } from 'pixi.js';
import { FloorScene } from './floor-scene';

const INTRO_KEY = 'lab:intro-seen';

export interface FloorHandle {
  pause(): void;
  resume(): void;
}

/** Boots Pixi and the Casino Floor into `parent`. Loaded on demand. */
export async function startFloor(
  parent: HTMLElement,
  openContact: () => void,
): Promise<FloorHandle> {
  const game = await createGame({
    parent,
    designWidth: 1280,
    designHeight: 720,
    portrait: { width: 720, height: 1280 },
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
    pause: () => game.app.ticker.stop(),
    resume: () => game.app.ticker.start(),
  };
}

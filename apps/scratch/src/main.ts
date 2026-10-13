import '@lab/core/game.css';
import './style.css';
import { createGame, MockOutcomeServer, seedFromQuery, SoundManager, Wallet } from '@lab/core';
import { Assets, type Texture } from 'pixi.js';
import { BET_LEVELS, resolveCard } from './logic/card';
import { ScratchScene } from './scratch-scene';

const game = await createGame({
  parent: document.getElementById('stage')!,
  designWidth: 1280,
  designHeight: 720,
  portrait: { width: 720, height: 1280 },
  background: '#08091a',
});

const [artwork] = await Promise.all([
  Assets.load<Texture>(`${import.meta.env.BASE_URL}art/diamond-dust.webp`),
  Promise.race([
    Promise.all(
      ['700 16px Orbitron', '900 16px Orbitron'].map((font) =>
        document.fonts.load(font).catch(() => []),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]),
]);

const sounds = new SoundManager();
sounds.synth({
  unlock: [784, 1175, 1568].map((freq, i) => ({
    freq,
    duration: 0.16,
    delay: i * 0.07,
    wave: 'triangle' as const,
    volume: 0.2,
  })),
  click: [{ freq: 900, duration: 0.04, wave: 'square', volume: 0.12 }],
  buy: [
    { freq: 988, duration: 0.08, wave: 'square', volume: 0.12 },
    { freq: 1319, duration: 0.18, delay: 0.07, wave: 'square', volume: 0.12 },
  ],
  scratch: [{ freq: 0, duration: 0.09, wave: 'noise', volume: 0.06 }],
  reveal: [{ freq: 300, to: 900, duration: 0.45, wave: 'triangle', volume: 0.2 }],
  win: [523, 659, 784, 1047].map((freq, i) => ({
    freq,
    duration: 0.22,
    delay: i * 0.09,
    wave: 'triangle' as const,
    volume: 0.25,
  })),
  miss: [{ freq: 320, to: 160, duration: 0.35, wave: 'sine', volume: 0.3 }],
});

await game.scenes.change(
  new ScratchScene({
    artwork,
    renderer: game.app.renderer,
    stats: __CARD_STATS__,
    // Same storage key as the hub and other games, so the balance carries between them.
    wallet: new Wallet({ betLevels: BET_LEVELS, defaultBet: 5 }),
    sounds,
    server: new MockOutcomeServer(resolveCard, { seed: seedFromQuery() }),
  }),
);

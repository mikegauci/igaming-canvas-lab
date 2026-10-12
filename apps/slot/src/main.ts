import { createGame, MockOutcomeServer, seedFromQuery, SoundManager, Wallet } from '@lab/core';
import { BET_LEVELS } from './logic/config';
import { resolveSpin } from './logic/evaluate';
import { exactStats } from './logic/stats';
import { SlotScene } from './slot-scene';
import { createSymbolTextures } from './view/symbol-textures';

const game = await createGame({
  parent: document.getElementById('stage')!,
  designWidth: 1280,
  designHeight: 720,
  portrait: { width: 720, height: 1280 },
});

const sounds = new SoundManager();
sounds.synth({
  click: [{ freq: 900, duration: 0.04, wave: 'square', volume: 0.12 }],
  spin: [{ freq: 220, to: 660, duration: 0.25, wave: 'triangle', volume: 0.25 }],
  stop: [
    { freq: 160, to: 60, duration: 0.14, wave: 'sine', volume: 0.5 },
    { freq: 0, duration: 0.04, wave: 'noise', volume: 0.12 },
  ],
  win: [523, 659, 784, 1047].map((freq, i) => ({
    freq,
    duration: 0.22,
    delay: i * 0.09,
    wave: 'triangle' as const,
    volume: 0.25,
  })),
});

await game.scenes.change(
  new SlotScene({
    textures: createSymbolTextures(game.app.renderer),
    stats: exactStats(),
    // Same storage key as the hub and other games, so the balance carries between them.
    wallet: new Wallet({ betLevels: BET_LEVELS, defaultBet: 25 }),
    sounds,
    server: new MockOutcomeServer(resolveSpin, { seed: seedFromQuery() }),
  }),
);

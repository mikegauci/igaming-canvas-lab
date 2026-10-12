import '@lab/core/game.css';
import { createGame, MockOutcomeServer, seedFromQuery, SoundManager, Wallet } from '@lab/core';
import { BET_LEVELS, resolveSpin } from './logic/prizes';
import { WheelScene } from './wheel-scene';

const game = await createGame({
  parent: document.getElementById('stage')!,
  designWidth: 1280,
  designHeight: 720,
  portrait: { width: 720, height: 1280 },
});

const sounds = new SoundManager();
sounds.synth({
  click: [{ freq: 900, duration: 0.04, wave: 'square', volume: 0.12 }],
  tick: [{ freq: 2200, to: 1600, duration: 0.018, wave: 'square', volume: 0.07 }],
  spin: [{ freq: 180, to: 520, duration: 0.35, wave: 'triangle', volume: 0.25 }],
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
  new WheelScene({
    renderer: game.app.renderer,
    stats: __WHEEL_STATS__,
    // Same storage key as the hub and other games, so the balance carries between them.
    wallet: new Wallet({ betLevels: BET_LEVELS, defaultBet: 10 }),
    sounds,
    server: new MockOutcomeServer(resolveSpin, { seed: seedFromQuery() }),
  }),
);

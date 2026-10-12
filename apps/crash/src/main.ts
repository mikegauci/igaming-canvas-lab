import '@lab/core/game.css';
import { createGame, seedFromQuery, SoundManager, Wallet } from '@lab/core';
import { CrashScene } from './crash-scene';
import { BET_LEVELS } from './logic/crash';
import { MockCrashServer } from './logic/server';

const game = await createGame({
  parent: document.getElementById('stage')!,
  designWidth: 1280,
  designHeight: 720,
  portrait: { width: 720, height: 1280 },
});

const sounds = new SoundManager();
sounds.synth({
  click: [{ freq: 900, duration: 0.04, wave: 'square', volume: 0.12 }],
  bet: [
    { freq: 988, duration: 0.08, wave: 'square', volume: 0.12 },
    { freq: 1319, duration: 0.16, delay: 0.07, wave: 'square', volume: 0.12 },
  ],
  launch: [
    { freq: 120, to: 480, duration: 0.6, wave: 'saw', volume: 0.12 },
    { freq: 0, duration: 0.5, wave: 'noise', volume: 0.06 },
  ],
  milestone: [
    { freq: 1047, duration: 0.12, wave: 'triangle', volume: 0.2 },
    { freq: 1568, duration: 0.18, delay: 0.08, wave: 'triangle', volume: 0.2 },
  ],
  cashout: [523, 659, 784, 1047, 1319].map((freq, i) => ({
    freq,
    duration: 0.2,
    delay: i * 0.07,
    wave: 'triangle' as const,
    volume: 0.25,
  })),
  crash: [
    { freq: 0, duration: 0.6, wave: 'noise', volume: 0.35 },
    { freq: 180, to: 40, duration: 0.6, wave: 'sine', volume: 0.4 },
  ],
});

await game.scenes.change(
  new CrashScene({
    renderer: game.app.renderer,
    // Same storage key as the hub and other games, so the balance carries between them.
    wallet: new Wallet({ betLevels: BET_LEVELS, defaultBet: 10 }),
    sounds,
    server: new MockCrashServer({ seed: seedFromQuery() }),
  }),
);

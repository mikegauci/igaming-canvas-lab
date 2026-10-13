import '@lab/core/game.css';
import './style.css';
import {
  colors,
  createGame,
  MockOutcomeServer,
  seedFromQuery,
  SoundManager,
  Wallet,
} from '@lab/core';
import { Assets, Container, Graphics, Rectangle, type Texture } from 'pixi.js';
import { BonusScene } from './bonus-scene';
import { BET_LEVELS, forcedResolver, resolveBonus } from './logic/prizes';
import { TIERS } from './logic/tiers';

const game = await createGame({
  parent: document.getElementById('stage')!,
  designWidth: 1280,
  designHeight: 720,
  portrait: { width: 720, height: 1280 },
  background: '#08091a',
});

const [artwork] = await Promise.all([
  Assets.load<Texture>(`${import.meta.env.BASE_URL}art/royal-fortune.webp`),
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
  pick: [{ freq: 660, to: 990, duration: 0.12, wave: 'square', volume: 0.12 }],
  open: [
    { freq: 220, to: 140, duration: 0.25, wave: 'saw', volume: 0.1 },
    { freq: 880, to: 1760, duration: 0.3, delay: 0.15, wave: 'triangle', volume: 0.18 },
  ],
  empty: [{ freq: 300, to: 150, duration: 0.4, wave: 'sine', volume: 0.3 }],
  win: [523, 659, 784, 1047].map((freq, i) => ({
    freq,
    duration: 0.22,
    delay: i * 0.09,
    wave: 'triangle' as const,
    volume: 0.25,
  })),
  tier: [392, 523, 659, 784].map((freq, i) => ({
    freq,
    duration: 0.3,
    delay: i * 0.1,
    wave: 'square' as const,
    volume: 0.14,
  })),
  tierUp: [523, 659, 784, 1047, 1319].map((freq, i) => ({
    freq,
    duration: 0.32,
    delay: i * 0.08,
    wave: 'square' as const,
    volume: 0.15,
  })),
  coins: Array.from({ length: 8 }, (_, i) => ({
    freq: 2000 + (i % 3) * 400,
    duration: 0.06,
    delay: i * 0.05,
    wave: 'triangle' as const,
    volume: 0.1,
  })),
});

// One small coin texture shared by every particle in the shower.
const coinArt = new Container({
  children: [
    new Graphics()
      .circle(0, 0, 22)
      .fill(colors.gold)
      .stroke({ color: 0xb8901a, width: 4 })
      .circle(0, 0, 14)
      .stroke({ color: 0xb8901a, width: 2, alpha: 0.6 })
      .star(0, 0, 5, 9, 4)
      .fill(0xfff1a8)
      .ellipse(-8, -10, 6, 3)
      .fill({ color: 0xffffff, alpha: 0.6 }),
  ],
});
const coinTexture = game.app.renderer.generateTexture({
  target: coinArt,
  frame: new Rectangle(-24, -24, 48, 48),
  resolution: game.app.renderer.resolution,
  antialias: true,
});
coinArt.destroy({ children: true });

// Showcase mode: ?demo=big|mega|epic always lands that tier, so the celebration can be seen
// (and recorded) without waiting for a rare draw. It says so on screen.
const demo = new URLSearchParams(window.location.search).get('demo')?.toUpperCase();
const demoTier = TIERS.find((tier) => tier.name === demo);
const resolver = demoTier ? forcedResolver(demoTier.at) : resolveBonus;

await game.scenes.change(
  new BonusScene({
    artwork,
    coinTexture,
    stats: __BONUS_STATS__,
    // Same storage key as the hub and other games, so the balance carries between them.
    wallet: new Wallet({ betLevels: BET_LEVELS, defaultBet: 10 }),
    sounds,
    server: new MockOutcomeServer(resolver, { seed: seedFromQuery() }),
    notice: demoTier
      ? `SHOWCASE MODE: EVERY PICK IS A ${demoTier.at}× ${demoTier.name} WIN`
      : undefined,
  }),
);

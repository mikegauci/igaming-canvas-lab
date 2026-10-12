import { colors, type AchievementId } from '@lab/core';

export interface GameInfo {
  id: 'slot' | 'wheel' | 'scratch' | 'crash' | 'bonus';
  title: string;
  /** One line for recruiters: what the demo shows. */
  caption: string;
  path: string;
  color: number;
  badge: AchievementId;
}

export const GAMES: readonly GameInfo[] = [
  {
    id: 'slot',
    title: 'MINI SLOT',
    caption: 'Slot machine: masked reels, reel splicing, server-decided outcomes',
    path: '/slot/',
    color: colors.neon,
    badge: 'slot-spin',
  },
  {
    id: 'wheel',
    title: 'LUCKY WHEEL',
    caption: 'Prize wheel: weighted outcomes, velocity-matched custom ease',
    path: '/wheel/',
    color: colors.gold,
    badge: 'wheel-win',
  },
  {
    id: 'scratch',
    title: 'SCRATCH',
    caption: 'Scratch card: RenderTexture brush, coverage grid, confetti',
    path: '/scratch/',
    color: colors.cyan,
    badge: 'scratch-match',
  },
  {
    id: 'crash',
    title: 'CRASH',
    caption: 'Crash: real-time curve, easing camera, server-timed cash-out race',
    path: '/crash/',
    color: 0xff3e5e,
    badge: 'crash-2x',
  },
  {
    id: 'bonus',
    title: 'BONUS',
    caption: 'Bonus round: rigged mascot, coin particles, BIG/MEGA/EPIC roll-up',
    path: '/bonus/',
    color: 0x7cff6b,
    badge: 'bonus-open',
  },
];

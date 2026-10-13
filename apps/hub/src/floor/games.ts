import { colors, type AchievementId } from '@lab/core';

export interface GameInfo {
  id: 'slot' | 'wheel' | 'scratch' | 'crash' | 'bonus';
  title: string;
  /** One line for recruiters: what the demo shows. */
  caption: string;
  path: string;
  color: number;
  badge: AchievementId;
  /** Decorative print on the cabinet's lower front (also cropped for the marquee). */
  art: string;
}

export const GAMES: readonly GameInfo[] = [
  {
    id: 'slot',
    title: 'MINI SLOT',
    caption: 'Slot machine: masked reels, reel splicing, server-decided outcomes',
    path: '/slot/',
    art: '/slot/art/miami-night.webp',
    color: colors.neon,
    badge: 'slot-spin',
  },
  {
    id: 'wheel',
    title: 'LUCKY WHEEL',
    caption: 'Prize wheel: weighted outcomes, velocity-matched custom ease',
    path: '/wheel/',
    art: '/wheel/art/cosmic-luck.webp',
    color: colors.gold,
    badge: 'wheel-win',
  },
  {
    id: 'scratch',
    title: 'SCRATCH',
    caption: 'Scratch card: RenderTexture brush, coverage grid, confetti',
    path: '/scratch/',
    art: '/scratch/art/diamond-dust.webp',
    color: colors.cyan,
    badge: 'scratch-match',
  },
  {
    id: 'crash',
    title: 'CRASH',
    caption: 'Crash: real-time curve, easing camera, server-timed cash-out race',
    path: '/crash/',
    art: '/crash/art/sunset-launch.webp',
    color: 0xff3e5e,
    badge: 'crash-2x',
  },
  {
    id: 'bonus',
    title: 'BONUS',
    caption: 'Bonus round: rigged mascot, coin particles, BIG/MEGA/EPIC roll-up',
    path: '/bonus/',
    art: '/bonus/art/royal-fortune.webp',
    color: 0x7cff6b,
    badge: 'bonus-open',
  },
];

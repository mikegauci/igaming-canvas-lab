export const SYMBOLS = ['cherry', 'lemon', 'bell', 'bar', 'seven', 'diamond'] as const;
export type SymbolId = (typeof SYMBOLS)[number];

export const ROWS = 3;

/**
 * Physical reel strips. The server picks one stop per reel; the visible window is the stop and
 * the next ROWS - 1 symbols. Symbol counts set the maths: reel 3 has one fewer diamond and one
 * more bell, so the top prize is rarer. See stats.ts for the exact RTP this produces.
 */
// prettier-ignore
export const REEL_STRIPS: readonly (readonly SymbolId[])[] = [
  [
    'bell', 'bar', 'bell', 'bar', 'bell', 'cherry', 'lemon', 'cherry', 'lemon', 'cherry', 'lemon', 'diamond',
    'lemon', 'bell', 'cherry', 'lemon', 'cherry', 'lemon', 'seven', 'cherry', 'seven', 'cherry', 'bar', 'diamond',
  ],
  [
    'lemon', 'diamond', 'cherry', 'bar', 'lemon', 'bar', 'cherry', 'lemon', 'cherry', 'lemon', 'cherry', 'bar',
    'diamond', 'bell', 'seven', 'bell', 'seven', 'cherry', 'lemon', 'cherry', 'bell', 'cherry', 'lemon', 'bell',
  ],
  [
    'bell', 'cherry', 'bell', 'cherry', 'seven', 'lemon', 'bar', 'bell', 'cherry', 'bell', 'lemon', 'bar',
    'lemon', 'bar', 'lemon', 'cherry', 'lemon', 'cherry', 'lemon', 'cherry', 'seven', 'bell', 'diamond', 'cherry',
  ],
];

/** Row index on each reel, left to right. */
export const PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1], // middle
  [0, 0, 0], // top
  [2, 2, 2], // bottom
  [0, 1, 2], // diagonal down
  [2, 1, 0], // diagonal up
];

/** Three of a kind on a line pays this many times the line bet. */
export const PAYTABLE: Readonly<Record<SymbolId, number>> = {
  cherry: 8,
  lemon: 12,
  bell: 25,
  bar: 60,
  seven: 150,
  diamond: 800,
};

/** Total bet per spin, spread evenly over the paylines, so every level divides by 5. */
export const BET_LEVELS = [5, 10, 25, 50, 100, 250, 500] as const;

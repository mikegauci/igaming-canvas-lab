import { colors, OddsTable } from '@lab/core';
import { Graphics } from 'pixi.js';
import type { WheelStats } from '../logic/prizes';
import { SEGMENT_STYLE, segmentLabel } from './wheel';

/** Prize odds straight from the weights, with a colour chip matching each segment. */
export function createOddsTable(stats: WheelStats): OddsTable {
  return new OddsTable({
    title: 'PRIZE ODDS',
    rows: stats.odds.map(({ multiplier, chance }) => ({
      icon: new Graphics()
        .circle(0, 0, 8)
        .fill(SEGMENT_STYLE[multiplier]!.fill)
        .stroke({ color: colors.gold, width: 1.5, alpha: 0.6 }),
      name: segmentLabel(multiplier),
      value: `${(chance * 100).toFixed(1)}%`,
    })),
    footer: `RTP ${(stats.rtp * 100).toFixed(1)}% · ANY WIN ${(stats.hitRate * 100).toFixed(0)}%`,
  });
}

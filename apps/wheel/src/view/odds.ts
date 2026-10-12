import { colors, Label } from '@lab/core';
import { Container, Graphics } from 'pixi.js';
import type { WheelStats } from '../logic/prizes';
import { SEGMENT_STYLE, segmentLabel } from './wheel';

const ROW_HEIGHT = 30;
const COLUMN_WIDTH = 210;

/** Prize odds straight from the weights: one column in landscape, two in portrait. */
export class OddsPanel extends Container {
  private readonly bg = new Graphics();
  private readonly title = new Label('PRIZE ODDS', 'caption');
  private readonly footer: Label;
  private readonly rows: Container[];

  constructor(stats: WheelStats) {
    super();
    this.rows = stats.odds.map(({ multiplier, chance }) => {
      const row = new Container();
      const chip = new Graphics()
        .circle(9, 0, 8)
        .fill(SEGMENT_STYLE[multiplier]!.fill)
        .stroke({ color: colors.gold, width: 1.5, alpha: 0.6 });
      const name = new Label(segmentLabel(multiplier), 'body', { fontSize: 20, fontWeight: '800' });
      name.anchor.set(0, 0.5);
      name.position.set(28, 0);
      const odds = new Label(`${(chance * 100).toFixed(1)}%`, 'body', {
        fontSize: 18,
        fill: colors.muted,
      });
      odds.anchor.set(1, 0.5);
      odds.position.set(COLUMN_WIDTH - 24, 0);
      row.addChild(chip, name, odds);
      return row;
    });
    this.footer = new Label(
      `RTP ${(stats.rtp * 100).toFixed(1)}% · ANY WIN ${(stats.hitRate * 100).toFixed(0)}%`,
      'caption',
      { fontSize: 12 },
    );
    this.addChild(this.bg, this.title, ...this.rows, this.footer);
  }

  /** Lays out for the orientation and returns the panel size. */
  arrange(orientation: 'landscape' | 'portrait'): { width: number; height: number } {
    const columns = orientation === 'landscape' ? 1 : 2;
    const perColumn = Math.ceil(this.rows.length / columns);
    const top = 44;
    const width = COLUMN_WIDTH * columns + 24;
    const height = top + perColumn * ROW_HEIGHT + 36;

    this.rows.forEach((row, i) => {
      const col = Math.floor(i / perColumn);
      row.position.set(
        12 + col * COLUMN_WIDTH + 12,
        top + (i % perColumn) * ROW_HEIGHT + ROW_HEIGHT / 2,
      );
    });
    this.title.anchor.set(0.5, 0);
    this.title.position.set(width / 2, 16);
    this.footer.anchor.set(0.5, 1);
    this.footer.position.set(width / 2, height - 12);
    this.bg
      .clear()
      .roundRect(0, 0, width, height, 18)
      .fill({ color: colors.panel, alpha: 0.85 })
      .stroke({ color: colors.cyan, width: 2, alpha: 0.35 });
    return { width, height };
  }
}

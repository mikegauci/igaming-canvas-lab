import { arcadeFont, colors, Label, metalFill } from '@lab/core';
import { Container, Graphics } from 'pixi.js';
import type { WheelStats } from '../logic/prizes';
import { SEGMENT_STYLE, segmentLabel } from './wheel';

/** Exact weighted odds, with prize chips matching the wheel's face. */
export class PrizeOddsPanel extends Container {
  private readonly bg = new Graphics();
  private readonly title = new Label('PRIZE ODDS', 'caption', {
    fontFamily: arcadeFont,
    fontSize: 16,
    letterSpacing: 2,
    fill: 0xe7f5ff,
  });
  private readonly subtitle = new Label('WEIGHTED PRIZES · WIN × BET', 'caption', {
    fontSize: 9,
    letterSpacing: 0.5,
    fill: 0xa2a8c9,
  });
  private readonly footer: Label;
  private readonly entries: Container[];

  constructor(stats: WheelStats) {
    super();
    this.entries = stats.odds.map(({ multiplier, chance }) => {
      const entry = new Container();
      const chip = new Graphics()
        .roundRect(0, -9, 18, 18, 4)
        .fill(SEGMENT_STYLE[multiplier]!.fill)
        .stroke({ color: SEGMENT_STYLE[multiplier]!.edge, width: 1.5 });
      const name = new Label(segmentLabel(multiplier), 'body', {
        fontFamily: arcadeFont,
        fontSize: 17,
        fontWeight: '700',
        fill: multiplier === 50 ? colors.gold : 0xe7f5ff,
      });
      name.anchor.set(0, 0.5);
      name.position.set(30, 0);
      const value = new Label(`${(chance * 100).toFixed(1)}%`, 'body', {
        fontSize: 17,
        fill: 0xc2bdd9,
      });
      value.anchor.set(1, 0.5);
      value.position.set(190, 0);
      entry.addChild(chip, name, value);
      return entry;
    });
    this.footer = new Label(
      `RTP ${(stats.rtp * 100).toFixed(1)}% · ANY WIN ${(stats.hitRate * 100).toFixed(0)}%`,
      'caption',
      { fontSize: 10, fill: 0xc2bdd9 },
    );
    this.title.anchor.set(0.5, 0);
    this.subtitle.anchor.set(0.5, 0);
    this.footer.anchor.set(0.5, 1);
    this.addChild(this.bg, this.title, this.subtitle, ...this.entries, this.footer);
  }

  arrange(orientation: 'landscape' | 'portrait'): { width: number; height: number } {
    const portrait = orientation === 'portrait';
    const columns = portrait ? 2 : 1;
    const columnWidth = portrait ? 270 : 212;
    const perColumn = Math.ceil(this.entries.length / columns);
    const rowHeight = portrait ? 32 : 37;
    const width = portrait ? 560 : 236;
    const height = 68 + perColumn * rowHeight + 34;
    this.title.position.set(width / 2, 18);
    this.subtitle.position.set(width / 2, 43);
    this.footer.position.set(width / 2, height - 12);
    this.bg
      .clear()
      .roundRect(0, 0, width, height, 12)
      .fill(metalFill())
      .stroke({ color: 0x919aba, width: 1 })
      .roundRect(5, 5, width - 10, height - 10, 8)
      .fill(0x101127)
      .stroke({ color: colors.cyan, width: 1, alpha: 0.4 })
      .moveTo(18, 60)
      .lineTo(width - 18, 60)
      .stroke({ color: colors.cyan, width: 1, alpha: 0.25 });
    this.entries.forEach((entry, i) => {
      const col = Math.floor(i / perColumn);
      const row = i % perColumn;
      entry.position.set(
        22 + col * columnWidth + (columnWidth - 212) / 2,
        68 + (row + 0.5) * rowHeight,
      );
      this.bg
        .roundRect(entry.x - 9, entry.y - rowHeight / 2 + 2, 208, rowHeight - 4, 4)
        .fill({ color: row % 2 ? 0x25223d : 0x191a31, alpha: 0.65 });
    });
    return { width, height };
  }
}

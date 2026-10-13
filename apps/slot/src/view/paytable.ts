import { arcadeFont, colors, Label, metalFill } from '@lab/core';
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { PAYLINES, PAYTABLE, SYMBOLS, type SymbolId } from '../logic/config';
import type { SlotStats } from '../logic/stats';

const ROW_HEIGHT = 49;
const ICON_SCALE = 0.36;
/** Icon plus the widest multiplier label, used to centre entries in their column. */
const ENTRY_WIDTH = 130;

/** "What pays" panel: one column in landscape, a 3×2 grid in portrait. */
export class PaytablePanel extends Container {
  private readonly bg = new Graphics();
  private readonly title = new Label('PAYTABLE', 'caption', {
    fontFamily: arcadeFont,
    fill: 0xe7f5ff,
    fontSize: 16,
    letterSpacing: 3,
  });
  private readonly subtitle = new Label('3 MATCHING SYMBOLS × LINE BET', 'caption', {
    fontSize: 9,
    letterSpacing: 0.6,
    fill: 0xa2a8c9,
  });
  private readonly footer: Label;
  private readonly entries: Container[];

  constructor(textures: Record<SymbolId, Texture>, stats: SlotStats) {
    super();
    const bySize = [...SYMBOLS].sort((a, b) => PAYTABLE[b] - PAYTABLE[a]);
    this.entries = bySize.map((id) => {
      const entry = new Container();
      const icon = new Sprite(textures[id]);
      icon.anchor.set(0.5);
      icon.scale.set(ICON_SCALE);
      icon.position.set(28, 0);
      const pays = new Label(`×${PAYTABLE[id]}`, 'body', {
        fontFamily: arcadeFont,
        fontSize: 19,
        fontWeight: '700',
        fill: colors.gold,
      });
      pays.anchor.set(0, 0.5);
      pays.position.set(64, 0);
      entry.addChild(icon, pays);
      return entry;
    });
    this.footer = new Label(
      `${PAYLINES.length} LINES · RTP ${(stats.rtp * 100).toFixed(1)}% · HIT 1 IN ${(1 / stats.hitRate).toFixed(1)}`,
      'caption',
      { fontSize: 9, letterSpacing: 0.25, fill: 0xc2bdd9 },
    );
    this.addChild(this.bg, this.title, this.subtitle, ...this.entries, this.footer);
  }

  /** Lays out for the orientation and returns the panel size. */
  arrange(orientation: 'landscape' | 'portrait'): { width: number; height: number } {
    const columns = orientation === 'landscape' ? 1 : 3;
    const columnWidth = orientation === 'landscape' ? 220 : 180;
    const rows = Math.ceil(this.entries.length / columns);
    const width = columnWidth * columns + 20;
    const top = 68;
    const height = top + rows * ROW_HEIGHT + 42;

    this.entries.forEach((entry, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = 10 + col * columnWidth + (columnWidth - ENTRY_WIDTH) / 2;
      entry.position.set(x, top + row * ROW_HEIGHT + ROW_HEIGHT / 2);
    });

    this.title.anchor.set(0.5, 0);
    this.title.position.set(width / 2, 18);
    this.subtitle.anchor.set(0.5, 0);
    this.subtitle.position.set(width / 2, 43);
    this.footer.anchor.set(0.5, 1);
    this.footer.position.set(width / 2, height - 14);
    this.bg
      .clear()
      .roundRect(0, 0, width, height, 12)
      .fill(metalFill())
      .stroke({ color: 0x919aba, width: 1 })
      .roundRect(5, 5, width - 10, height - 10, 8)
      .fill({ color: 0x101127, alpha: 0.98 })
      .stroke({ color: colors.cyan, width: 1, alpha: 0.4 })
      .moveTo(18, 60)
      .lineTo(width - 18, 60)
      .stroke({ color: colors.cyan, width: 1, alpha: 0.25 });
    this.entries.forEach((entry, i) => {
      this.bg
        .roundRect(entry.x - 10, entry.y - 21, ENTRY_WIDTH + 20, 42, 5)
        .fill({ color: i % 2 ? 0x25223d : 0x191a31, alpha: 0.55 });
    });
    return { width, height };
  }
}

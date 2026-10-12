import { colors, Label } from '@lab/core';
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { PAYLINES, PAYTABLE, SYMBOLS, type SymbolId } from '../logic/config';
import type { SlotStats } from '../logic/stats';

const ROW_HEIGHT = 58;
const ICON_SCALE = 0.36;
/** Icon plus the widest multiplier label, used to centre entries in their column. */
const ENTRY_WIDTH = 130;

/** "What pays" panel: one column in landscape, a 3×2 grid in portrait. */
export class PaytablePanel extends Container {
  private readonly bg = new Graphics();
  private readonly title = new Label('3 IN A LINE PAYS × LINE BET', 'caption');
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
      const pays = new Label(`×${PAYTABLE[id]}`, 'body', { fontWeight: '800', fill: colors.gold });
      pays.anchor.set(0, 0.5);
      pays.position.set(64, 0);
      entry.addChild(icon, pays);
      return entry;
    });
    this.footer = new Label(
      `${PAYLINES.length} LINES · RTP ${(stats.rtp * 100).toFixed(1)}% · HIT 1 IN ${(1 / stats.hitRate).toFixed(1)}`,
      'caption',
      { fontSize: 12 },
    );
    this.addChild(this.bg, this.title, ...this.entries, this.footer);
  }

  /** Lays out for the orientation and returns the panel size. */
  arrange(orientation: 'landscape' | 'portrait'): { width: number; height: number } {
    const columns = orientation === 'landscape' ? 1 : 3;
    const columnWidth = orientation === 'landscape' ? 250 : 220;
    const rows = Math.ceil(this.entries.length / columns);
    const width = columnWidth * columns + 20;
    const top = 44;
    const height = top + rows * ROW_HEIGHT + 40;

    this.entries.forEach((entry, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = 10 + col * columnWidth + (columnWidth - ENTRY_WIDTH) / 2;
      entry.position.set(x, top + row * ROW_HEIGHT + ROW_HEIGHT / 2);
    });

    this.title.anchor.set(0.5, 0);
    this.title.position.set(width / 2, 16);
    this.footer.anchor.set(0.5, 1);
    this.footer.position.set(width / 2, height - 14);
    this.bg
      .clear()
      .roundRect(0, 0, width, height, 18)
      .fill({ color: colors.panel, alpha: 0.85 })
      .stroke({ color: colors.cyan, width: 2, alpha: 0.35 });
    return { width, height };
  }
}

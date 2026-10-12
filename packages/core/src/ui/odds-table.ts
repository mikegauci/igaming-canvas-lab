import { Container, Graphics } from 'pixi.js';
import { colors } from '../theme';
import { Label } from './label';

export interface OddsRow {
  /** Small marker drawn left of the name (a colour chip, a symbol sprite…), centred on 0,0. */
  icon?: Container;
  name: string;
  /** Right-aligned value, e.g. "0.4%". */
  value: string;
}

export interface OddsTableOptions {
  title: string;
  rows: readonly OddsRow[];
  footer: string;
  columnWidth?: number;
}

const ROW_HEIGHT = 30;
const PADDING = 12;
const TOP = 44;

/** Panel listing prizes and their chances, in one or more columns. */
export class OddsTable extends Container {
  private readonly bg = new Graphics();
  private readonly title: Label;
  private readonly footer: Label;
  private readonly rows: Container[];
  private readonly columnWidth: number;

  constructor({ title, rows, footer, columnWidth = 210 }: OddsTableOptions) {
    super();
    this.columnWidth = columnWidth;
    this.title = new Label(title, 'caption');
    this.title.anchor.set(0.5, 0);
    this.footer = new Label(footer, 'caption', { fontSize: 12 });
    this.footer.anchor.set(0.5, 1);
    this.rows = rows.map(({ icon, name, value }) => {
      const row = new Container();
      if (icon) {
        icon.position.set(10, 0);
        row.addChild(icon);
      }
      const nameLabel = new Label(name, 'body', { fontSize: 20, fontWeight: '800' });
      nameLabel.anchor.set(0, 0.5);
      nameLabel.position.set(28, 0);
      const valueLabel = new Label(value, 'body', { fontSize: 18, fill: colors.muted });
      valueLabel.anchor.set(1, 0.5);
      valueLabel.position.set(columnWidth - 24, 0);
      row.addChild(nameLabel, valueLabel);
      return row;
    });
    this.addChild(this.bg, this.title, ...this.rows, this.footer);
  }

  /** Lays the rows out in `columns` columns (filled top to bottom) and returns the panel size. */
  arrange(columns: number): { width: number; height: number } {
    const perColumn = Math.ceil(this.rows.length / columns);
    const width = this.columnWidth * columns + PADDING * 2;
    const height = TOP + perColumn * ROW_HEIGHT + 36;

    this.rows.forEach((row, i) => {
      const column = Math.floor(i / perColumn);
      row.position.set(
        PADDING * 2 + column * this.columnWidth,
        TOP + (i % perColumn) * ROW_HEIGHT + ROW_HEIGHT / 2,
      );
    });
    this.title.position.set(width / 2, 16);
    this.footer.position.set(width / 2, height - 12);
    this.bg
      .clear()
      .roundRect(0, 0, width, height, 18)
      .fill({ color: colors.panel, alpha: 0.85 })
      .stroke({ color: colors.cyan, width: 2, alpha: 0.35 });
    return { width, height };
  }
}

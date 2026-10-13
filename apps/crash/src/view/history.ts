import { arcadeFont, colors, Label } from '@lab/core';
import { BitmapText, Container, Graphics } from 'pixi.js';

const PILL_HEIGHT = 30;
const GAP = 6;
/** Row: pill width. Column: pill width, the panel's padding and the gap under its title. */
const ROW_PILL_WIDTH = 66;
const COLUMN_PILL_WIDTH = 150;
const PANEL_PADDING = 22;
const PANEL_TOP = 50;

const pillColor = (point: number): number =>
  point >= 10 ? colors.cyan : point >= 2 ? colors.gold : 0xff3e5e;

/**
 * Recent crash points, newest first, like the strip every crash game shows: a row under the
 * chart on phones, a framed column beside it in landscape.
 */
export class HistoryBar extends Container {
  private readonly bg = new Graphics();
  private readonly pills: { view: Container; bg: Graphics; text: BitmapText }[];
  private readonly points: number[] = [];
  private readonly title = new Label('LAST ROUNDS', 'caption', {
    fontFamily: arcadeFont,
    fontSize: 11,
    letterSpacing: 1.5,
    fill: 0xc2c0db,
  });
  private pillWidth = ROW_PILL_WIDTH;

  constructor(private readonly capacity: number) {
    super();
    this.addChild(this.bg, this.title);
    this.pills = Array.from({ length: capacity }, () => {
      const bg = new Graphics();
      const text = new BitmapText({
        text: '',
        style: { fontFamily: arcadeFont, fontSize: 12, fontWeight: 'bold', fill: 0xffffff },
      });
      text.anchor.set(0.5);
      const view = new Container({ children: [bg, text] });
      this.addChild(view);
      return { view, bg, text };
    });
    this.arrange('row');
  }

  /** Lays the strip out as a row or a framed column, and returns its size. */
  arrange(layout: 'row' | 'column'): { width: number; height: number } {
    const column = layout === 'column';
    this.pillWidth = column ? COLUMN_PILL_WIDTH : ROW_PILL_WIDTH;
    let width: number;
    let height: number;
    if (column) {
      width = COLUMN_PILL_WIDTH + PANEL_PADDING * 2;
      height = PANEL_TOP + this.capacity * (PILL_HEIGHT + GAP) - GAP + PANEL_PADDING;
      this.title.anchor.set(0.5);
      this.title.position.set(width / 2, 26);
      this.pills.forEach(({ view }, i) =>
        view.position.set(PANEL_PADDING, PANEL_TOP + i * (PILL_HEIGHT + GAP)),
      );
      this.bg
        .clear()
        .roundRect(0, 0, width, height, 18)
        .fill({ color: colors.panel, alpha: 0.85 })
        .stroke({ color: colors.cyan, width: 2, alpha: 0.35 });
    } else {
      const start = this.title.width + 14;
      width = start + this.capacity * (ROW_PILL_WIDTH + GAP) - GAP;
      height = PILL_HEIGHT;
      this.title.anchor.set(0, 0.5);
      this.title.position.set(0, PILL_HEIGHT / 2);
      this.pills.forEach(({ view }, i) => view.position.set(start + i * (ROW_PILL_WIDTH + GAP), 0));
      this.bg.clear();
    }
    this.render();
    return { width, height };
  }

  push(point: number): void {
    this.points.unshift(point);
    this.points.length = Math.min(this.points.length, this.capacity);
    this.render();
  }

  private render() {
    const w = this.pillWidth;
    this.pills.forEach(({ bg, text }, i) => {
      const point = this.points[i];
      text.position.set(w / 2, PILL_HEIGHT / 2);
      bg.clear().roundRect(0, 0, w, PILL_HEIGHT, PILL_HEIGHT / 2);
      if (point === undefined) {
        bg.fill({ color: 0x101127, alpha: 0.6 }).stroke({
          color: 0x5c5b80,
          width: 1.5,
          alpha: 0.5,
        });
        text.text = '';
      } else {
        // Dark enamel with a neon edge; the newest round glows brighter.
        const color = pillColor(point);
        bg.fill({ color: 0x101127, alpha: 0.92 }).stroke({
          color,
          width: i === 0 ? 2.5 : 1.5,
          alpha: i === 0 ? 1 : 0.7,
        });
        if (i === 0)
          bg.roundRect(-3, -3, w + 6, PILL_HEIGHT + 6, PILL_HEIGHT / 2 + 3).stroke({
            color,
            width: 6,
            alpha: 0.15,
          });
        text.text = `${point.toFixed(2)}×`;
        text.tint = color;
        text.alpha = i === 0 ? 1 : 0.8;
      }
    });
  }
}

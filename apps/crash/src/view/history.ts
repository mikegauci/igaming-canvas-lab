import { colors, fontFamily, Label } from '@lab/core';
import { BitmapText, Container, Graphics } from 'pixi.js';

const PILL_WIDTH = 64;
const PILL_HEIGHT = 30;
const GAP = 8;

const pillColor = (point: number): number =>
  point >= 10 ? colors.cyan : point >= 2 ? colors.gold : 0xff3e5e;

/** Recent crash points, newest first, like the strip every crash game shows. */
export class HistoryBar extends Container {
  private readonly pills: { bg: Graphics; text: BitmapText }[];
  private readonly points: number[] = [];
  private readonly title = new Label('LAST ROUNDS', 'caption');

  constructor(private readonly capacity: number) {
    super();
    this.title.anchor.set(0, 0.5);
    this.title.position.set(0, PILL_HEIGHT / 2);
    this.addChild(this.title);
    const start = this.title.width + 14;
    this.pills = Array.from({ length: capacity }, (_, i) => {
      const bg = new Graphics();
      const text = new BitmapText({
        text: '',
        style: { fontFamily, fontSize: 15, fontWeight: 'bold', fill: colors.bg },
      });
      text.anchor.set(0.5);
      const pill = new Container({ children: [bg, text] });
      pill.x = start + i * (PILL_WIDTH + GAP);
      text.position.set(PILL_WIDTH / 2, PILL_HEIGHT / 2);
      this.addChild(pill);
      return { bg, text };
    });
    this.render();
  }

  push(point: number): void {
    this.points.unshift(point);
    this.points.length = Math.min(this.points.length, this.capacity);
    this.render();
  }

  private render() {
    this.pills.forEach(({ bg, text }, i) => {
      const point = this.points[i];
      bg.clear().roundRect(0, 0, PILL_WIDTH, PILL_HEIGHT, PILL_HEIGHT / 2);
      if (point === undefined) {
        bg.stroke({ color: colors.muted, width: 1.5, alpha: 0.3 });
        text.text = '';
      } else {
        bg.fill({ color: pillColor(point), alpha: i === 0 ? 1 : 0.75 });
        text.text = `${point.toFixed(2)}×`;
      }
    });
  }
}

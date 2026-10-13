import { arcadeFont, colors, Label } from '@lab/core';
import { BitmapText, Container, Graphics } from 'pixi.js';

const PILL_WIDTH = 66;
const PILL_HEIGHT = 30;
const GAP = 6;

const pillColor = (point: number): number =>
  point >= 10 ? colors.cyan : point >= 2 ? colors.gold : 0xff3e5e;

/** Recent crash points, newest first, like the strip every crash game shows. */
export class HistoryBar extends Container {
  private readonly pills: { bg: Graphics; text: BitmapText }[];
  private readonly points: number[] = [];
  private readonly title = new Label('LAST ROUNDS', 'caption', {
    fontFamily: arcadeFont,
    fontSize: 11,
    letterSpacing: 1.5,
    fill: 0xc2c0db,
  });

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
        style: { fontFamily: arcadeFont, fontSize: 12, fontWeight: 'bold', fill: 0xffffff },
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
          bg.roundRect(-3, -3, PILL_WIDTH + 6, PILL_HEIGHT + 6, PILL_HEIGHT / 2 + 3).stroke({
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

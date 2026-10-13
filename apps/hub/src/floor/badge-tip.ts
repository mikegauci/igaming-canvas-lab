import { colors, Label } from '@lab/core';
import { Container, Graphics } from 'pixi.js';

export interface BadgeTipContent {
  game: string;
  title: string;
  hint: string;
  earned: boolean;
  color: number;
  /** Badges collected so far, and how many there are. */
  progress: [number, number];
}

const PAD = 12;

/** A small card under the badge row: which game, what the badge is, how to earn it and progress. */
export class BadgeTip extends Container {
  private readonly panel = new Graphics();
  private readonly heading = new Label('', 'caption', { fontSize: 12 });
  private readonly title = new Label('', 'body', { fontSize: 17, fontWeight: '700' });
  private readonly hint = new Label('', 'body', { fontSize: 14, fill: colors.muted });
  private readonly status = new Label('', 'caption', { fontSize: 12 });

  constructor() {
    super();
    this.eventMode = 'none';
    this.visible = false;
    this.addChild(this.panel, this.heading, this.title, this.hint, this.status);
  }

  show({ game, title, hint, earned, color, progress }: BadgeTipContent) {
    const [have, total] = progress;
    this.heading.text = `${game} · BADGE`;
    this.heading.style.fill = color;
    this.title.text = title;
    this.hint.text = earned ? `Earned: ${hint.toLowerCase()}` : `To earn: ${hint.toLowerCase()}`;
    this.status.text = earned ? `✓ UNLOCKED · ${have}/${total}` : `LOCKED · ${have}/${total}`;
    this.status.style.fill = earned ? color : colors.muted;

    let y = PAD;
    for (const line of [this.heading, this.title, this.hint, this.status]) {
      line.position.set(PAD, y);
      y += line.height + 4;
    }
    const width = Math.max(
      this.heading.width,
      this.title.width,
      this.hint.width,
      this.status.width,
    );
    this.panel
      .clear()
      .roundRect(0, 0, width + PAD * 2, y - 4 + PAD, 10)
      .fill({ color: 0x07020f, alpha: 0.9 })
      .stroke({ color, width: 2, alpha: 0.8 });
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }
}

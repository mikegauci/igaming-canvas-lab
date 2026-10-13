import { Container, Graphics } from 'pixi.js';
import type { SoundManager } from '../sound';
import { colors } from '../theme';

/** Round speaker toggle bound to a SoundManager. Centred on its position. */
export class MuteButton extends Container {
  private readonly icon = new Graphics();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly sounds: SoundManager,
    private readonly size = 56,
    appearance: 'classic' | 'arcade' = 'classic',
  ) {
    super();
    const bg = new Graphics()
      .circle(0, 0, size / 2)
      .fill({ color: colors.panel, alpha: 0.9 })
      .stroke({ color: colors.cyan, alpha: 0.5, width: 2 });
    if (appearance === 'arcade') {
      bg.circle(0, 0, size / 2 + 3)
        .stroke({ color: colors.cyan, width: 8, alpha: 0.12 })
        .circle(0, 0, size / 2)
        .stroke({ color: 0xb6f8ff, width: 1.5 });
    }
    this.addChild(bg, this.icon);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.accessible = true;
    this.accessibleType = 'button';
    this.on('pointertap', () => sounds.toggle());

    this.unsubscribe = sounds.onChange(() => this.draw());
    this.draw();
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    this.unsubscribe();
    super.destroy(...args);
  }

  private draw() {
    const muted = this.sounds.muted;
    const s = this.size / 56;
    const stroke = { color: colors.text, width: 3 * s, cap: 'round' as const };
    this.accessibleTitle = muted ? 'Unmute sound' : 'Mute sound';

    this.icon
      .clear()
      .poly([-14, -6, -6, -6, 4, -14, 4, 14, -6, 6, -14, 6].map((v) => v * s))
      .fill(colors.text);
    if (muted) {
      this.icon
        .moveTo(10 * s, -7 * s)
        .lineTo(22 * s, 7 * s)
        .moveTo(22 * s, -7 * s)
        .lineTo(10 * s, 7 * s)
        .stroke({ ...stroke, color: colors.neon });
    } else {
      // Start each wave with moveTo, or the arc is joined to the speaker by a stray line.
      for (const r of [9, 16]) {
        this.icon
          .moveTo(4 * s + Math.cos(-0.75) * r * s, Math.sin(-0.75) * r * s)
          .arc(4 * s, 0, r * s, -0.75, 0.75)
          .stroke(stroke);
      }
    }
  }
}

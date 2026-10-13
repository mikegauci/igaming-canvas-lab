import { Container, Graphics } from 'pixi.js';
import { tubeCore } from './neon';

/** A glyph drawn as an open path in a 32×32 box centred on 0,0; the button strokes it as a tube. */
export type Glyph = (g: Graphics, on: boolean) => void;

/**
 * A round neon-tube button for the floor's HUD: a ring and a glyph, both drawn as tubes (faint
 * glow, halo, white-hot core). Dimmed while off. Centred on its position.
 */
export class NeonIconButton extends Container {
  private readonly ring = new Graphics();
  private readonly icon = new Graphics();
  private readonly color: number;
  private readonly radius: number;
  private readonly glyph: Glyph;
  private readonly titleFor: (on: boolean) => string;
  private state = true;

  constructor(glyph: Glyph, color: number, title: (on: boolean) => string, size = 46) {
    super();
    this.glyph = glyph;
    this.color = color;
    this.radius = size / 2;
    this.addChild(this.ring, this.icon);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.accessible = true;
    this.accessibleType = 'button';
    this.titleFor = title;
    this.draw();
  }

  /** Lit (sound on, stats showing) or dimmed. Not 'on': that's the event emitter's method. */
  get lit(): boolean {
    return this.state;
  }

  set lit(value: boolean) {
    this.state = value;
    this.draw();
  }

  private draw() {
    const { color, radius, state } = this;
    const alpha = state ? 1 : 0.5;
    this.accessibleTitle = this.titleFor(state);
    this.ring
      .clear()
      .circle(0, 0, radius)
      .fill({ color: 0x07020f, alpha: 0.75 })
      .circle(0, 0, radius)
      .stroke({ color, width: 8, alpha: 0.18 * alpha })
      .circle(0, 0, radius)
      .stroke({ color, width: 4, alpha: 0.5 * alpha })
      .circle(0, 0, radius)
      .stroke({ color: tubeCore(color), width: 1.6, alpha });

    const g = this.icon.clear();
    const tube = (width: number, strokeColor: number, strokeAlpha: number) => {
      this.glyph(g, state);
      g.stroke({ color: strokeColor, width, alpha: strokeAlpha, cap: 'round', join: 'round' });
    };
    tube(6, color, 0.3 * alpha);
    tube(2.4, tubeCore(color), alpha);
  }
}

/** Speaker with sound waves, or with a cross when muted. */
export const speakerGlyph: Glyph = (g, on) => {
  g.poly([-11, -4, -6, -4, 0, -10, 0, 10, -6, 4, -11, 4], true);
  if (on) {
    // Each arc starts with moveTo, so it isn't joined to the speaker by a stray line.
    for (const r of [6, 11]) {
      g.moveTo(Math.cos(-0.8) * r + 2, Math.sin(-0.8) * r).arc(2, 0, r, -0.8, 0.8);
    }
  } else {
    g.moveTo(5, -5).lineTo(13, 5).moveTo(13, -5).lineTo(5, 5);
  }
};

/** A heartbeat trace: the stats panel (FPS, draw calls, tier). */
export const pulseGlyph: Glyph = (g) => {
  g.moveTo(-13, 1)
    .lineTo(-6, 1)
    .lineTo(-3, -8)
    .lineTo(2, 9)
    .lineTo(5, -2)
    .lineTo(7, 1)
    .lineTo(13, 1);
};

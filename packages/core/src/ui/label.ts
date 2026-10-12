import { Text, type TextStyleOptions } from 'pixi.js';
import { colors, fontFamily } from '../theme';

const variants = {
  title: { fontSize: 44, fontWeight: '800', fill: colors.text, letterSpacing: 2 },
  body: { fontSize: 22, fontWeight: '500', fill: colors.text },
  caption: { fontSize: 14, fontWeight: '600', fill: colors.muted, letterSpacing: 1.5 },
} satisfies Record<string, TextStyleOptions>;

export type LabelVariant = keyof typeof variants;

/** Text with the lab's type scale. Use BitmapText instead for numbers that change every frame. */
export class Label extends Text {
  constructor(text: string, variant: LabelVariant = 'body', style: TextStyleOptions = {}) {
    super({ text, style: { fontFamily, ...variants[variant], ...style } });
  }
}

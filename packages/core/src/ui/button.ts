import { gsap } from 'gsap';
import { Container, Graphics, Text } from 'pixi.js';
import { colors, fontFamily } from '../theme';
import { arcadeFont, verticalGradient } from './arcade-style';

export interface ButtonOptions {
  label: string;
  width?: number;
  height?: number;
  color?: number;
  textColor?: number;
  fontSize?: number;
  /** Screen-reader name when the visible label isn't descriptive (e.g. '+'). */
  title?: string;
  /** Keyboard shortcut announced after the name, e.g. 'Space'. */
  shortcut?: string;
  onPress?: () => void;
  appearance?: 'classic' | 'arcade';
}

/**
 * Pill button centred on its position. Pointer, touch and Pixi's accessibility layer
 * (Tab + Enter) all arrive as `pointertap`.
 */
export class Button extends Container {
  onPress?: () => void;
  private readonly bg = new Graphics();
  private readonly textView: Text;
  private readonly title?: string;
  private readonly shortcut?: string;
  private _enabled = true;

  constructor({
    label,
    width = 180,
    height = 64,
    color = colors.neon,
    textColor = colors.bg,
    fontSize = 24,
    title,
    shortcut,
    onPress,
    appearance = 'classic',
  }: ButtonOptions) {
    super();
    this.onPress = onPress;
    this.title = title;
    this.shortcut = shortcut;

    if (appearance === 'arcade') {
      const hex = `#${color.toString(16).padStart(6, '0')}`;
      this.bg
        .roundRect(-width / 2 - 5, -height / 2 - 3, width + 10, height + 14, height / 2)
        .fill(0x050610)
        .stroke({ color: 0x8d95b2, width: 2 })
        .roundRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4, height / 2)
        .stroke({ color, width: 9, alpha: 0.12 })
        .roundRect(-width / 2, -height / 2, width, height, height / 2)
        .fill(
          verticalGradient([
            [0, '#fff4fc'],
            [0.16, hex],
            [0.6, hex],
            [1, color === colors.cyan ? '#12546f' : '#5a164e'],
          ]),
        )
        .stroke({ color: 0xffd5ee, width: 2, alpha: 0.8 })
        .roundRect(-width * 0.31, -height * 0.36, width * 0.62, height * 0.17, height * 0.08)
        .fill({ color: 0xffffff, alpha: 0.22 });
    } else {
      this.bg.roundRect(-width / 2, -height / 2, width, height, height / 2).fill(color);
    }
    this.textView = new Text({
      text: label,
      style: {
        fontFamily: appearance === 'arcade' ? arcadeFont : fontFamily,
        fontSize,
        fontWeight: '800',
        fill: textColor,
        letterSpacing: 1,
      },
    });
    this.textView.anchor.set(0.5);
    this.addChild(this.bg, this.textView);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.accessible = true;
    this.accessibleType = 'button';
    this.updateAccessibleTitle();

    this.on('pointerover', () => this.animateTo(1.05));
    this.on('pointerout', () => this.animateTo(1));
    this.on('pointerdown', () => this.animateTo(0.94, 0.06));
    this.on('pointerup', () => this.animateTo(1.05));
    this.on('pointerupoutside', () => this.animateTo(1));
    this.on('pointertap', () => {
      if (this._enabled) this.onPress?.();
    });
  }

  get text(): string {
    return this.textView.text;
  }

  set text(value: string) {
    this.textView.text = value;
    this.updateAccessibleTitle();
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.eventMode = value ? 'static' : 'none';
    this.cursor = value ? 'pointer' : 'default';
    this.alpha = value ? 1 : 0.45;
    if (!value) this.animateTo(1);
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    gsap.killTweensOf(this.scale);
    super.destroy(...args);
  }

  private updateAccessibleTitle() {
    const name = this.title ?? this.textView.text;
    this.accessibleTitle = this.shortcut ? `${name} (${this.shortcut})` : name;
  }

  private animateTo(scale: number, duration = 0.12) {
    gsap.to(this.scale, { x: scale, y: scale, duration, ease: 'power2.out', overwrite: true });
  }
}

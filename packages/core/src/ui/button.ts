import { gsap } from 'gsap';
import { Container, Graphics, Text } from 'pixi.js';
import { colors, fontFamily } from '../theme';

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
  }: ButtonOptions) {
    super();
    this.onPress = onPress;
    this.title = title;
    this.shortcut = shortcut;

    this.bg.roundRect(-width / 2, -height / 2, width, height, height / 2).fill(color);
    this.textView = new Text({
      text: label,
      style: { fontFamily, fontSize, fontWeight: '800', fill: textColor, letterSpacing: 1 },
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

import { gsap } from 'gsap';
import { BitmapText, Container, Graphics } from 'pixi.js';
import { colors, fontFamily } from '../theme';
import { formatCredits, type Wallet } from '../wallet';
import { Label } from './label';

interface Field {
  value: BitmapText;
  /** Number currently on screen; tweened towards the real value. */
  shown: number;
}

/**
 * BALANCE / BET / WIN strip bound to a Wallet. Values use BitmapText because they change every
 * frame during count-ups, and re-rasterising a canvas Text each frame is expensive.
 */
export class BalancePanel extends Container {
  private readonly balance: Field;
  private readonly bet: Field;
  private readonly win: Field;
  private readonly unsubscribe: () => void;
  private held = false;

  constructor(
    private readonly wallet: Wallet,
    width = 720,
    height = 76,
  ) {
    super();
    const bg = new Graphics()
      .roundRect(0, 0, width, height, 16)
      .fill({ color: colors.panel, alpha: 0.92 })
      .stroke({ color: colors.neon, alpha: 0.45, width: 2 });
    this.addChild(bg);

    const field = (caption: string, index: number, color: number, initial: number): Field => {
      const x = (width * (index + 0.5)) / 3;
      const label = new Label(caption, 'caption');
      label.anchor.set(0.5);
      label.position.set(x, height * 0.3);
      const value = new BitmapText({
        text: formatCredits(initial),
        style: { fontFamily, fontSize: 28, fontWeight: 'bold', fill: color },
      });
      value.anchor.set(0.5);
      value.position.set(x, height * 0.66);
      this.addChild(label, value);
      return { value, shown: initial };
    };

    this.balance = field('BALANCE', 0, colors.text, wallet.balance);
    this.bet = field('BET', 1, colors.cyan, wallet.bet);
    this.win = field('WIN', 2, colors.gold, 0);

    this.unsubscribe = wallet.onChange(({ balance, bet }) => {
      if (!this.held) void this.tween(this.balance, balance, 0.4);
      void this.tween(this.bet, bet, 0);
    });
  }

  /**
   * Freezes the displayed balance. The wallet (the "server" balance) is credited as soon as a
   * result arrives, but players should only see it go up after the win has been presented.
   */
  hold(): void {
    this.held = true;
  }

  /** Shows the real balance again, tweening to it. */
  release(): void {
    this.held = false;
    void this.tween(this.balance, this.wallet.balance, 0.4);
  }

  /** Counts the WIN field up from 0. Resolves when the count finishes. */
  showWin(amount: number, duration = 1): Promise<void> {
    this.win.shown = 0;
    return this.tween(this.win, amount, duration);
  }

  /** Jumps a running count-up to its final value (e.g. when the player taps to skip). */
  skipCountUp(): void {
    gsap.getTweensOf(this.win).forEach((tween) => tween.progress(1));
  }

  clearWin(): void {
    void this.tween(this.win, 0, 0);
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    this.unsubscribe();
    gsap.killTweensOf([this.balance, this.bet, this.win]);
    super.destroy(...args);
  }

  private async tween(field: Field, to: number, duration: number): Promise<void> {
    const render = () => (field.value.text = formatCredits(Math.round(field.shown)));
    if (duration <= 0) {
      gsap.killTweensOf(field);
      field.shown = to;
      render();
      return;
    }
    await gsap.to(field, {
      shown: to,
      duration,
      ease: 'power1.out',
      overwrite: true,
      onUpdate: render,
    });
  }
}

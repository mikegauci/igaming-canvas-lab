import { Container } from 'pixi.js';
import { onKey } from '../input';
import type { OutcomeService, RoundRequest, RoundResult } from '../outcome';
import { countUpSeconds } from '../presentation';
import type { SoundManager } from '../sound';
import { colors } from '../theme';
import { formatCredits, type Wallet } from '../wallet';
import { BalancePanel } from './balance-panel';
import { Button } from './button';
import { Label } from './label';
import { MuteButton } from './mute-button';

export interface GameHudOptions {
  title: string;
  wallet: Wallet;
  sounds: SoundManager;
  /** Label of the main action button (SPIN, BUY…). */
  actionLabel: string;
  /** Diameter of the main action button. */
  actionSize?: number;
  betCaption?: string;
  /** Screen-reader names for the bet buttons. */
  betTitles?: readonly [lower: string, raise: string];
  panelWidth?: number;
}

export type RoundStart<TOutcome> =
  | { status: 'unaffordable' }
  | { status: 'failed' }
  | { status: 'settled'; result: RoundResult<TOutcome> };

const MESSAGE_GAP = 44;

/**
 * Everything around the play area that every game shares: title and message line, the main
 * action button with bet −/+ and keyboard shortcuts, the balance panel and mute. It also runs the
 * money side of a round (stake, server call, settle, present, release), so each game only
 * animates its own outcome.
 */
export class GameHud extends Container {
  /** Main action (Space). */
  onAction?: () => void;

  readonly title: Label;
  readonly message = new Label('', 'body', { fill: colors.muted });
  readonly action: Button;
  readonly betDown: Button;
  readonly betUp: Button;
  readonly betCaption: Label;
  readonly panel: BalancePanel;
  readonly mute: MuteButton;
  readonly panelWidth: number;

  private readonly wallet: Wallet;
  private readonly sounds: SoundManager;
  private readonly actionSize: number;
  private betting = true;
  private keyBindings: (() => void)[] = [];

  constructor({
    title,
    wallet,
    sounds,
    actionLabel,
    actionSize = 140,
    betCaption = 'BET',
    betTitles = ['Lower bet', 'Raise bet'],
    panelWidth = 520,
  }: GameHudOptions) {
    super();
    this.wallet = wallet;
    this.sounds = sounds;
    this.actionSize = actionSize;
    this.panelWidth = panelWidth;

    this.title = new Label(title, 'title', {
      dropShadow: { color: colors.neon, blur: 12, distance: 0, alpha: 0.9 },
    });
    this.title.anchor.set(0.5);
    this.message.anchor.set(0.5);

    this.action = new Button({
      label: actionLabel,
      shortcut: 'Space',
      width: actionSize,
      height: actionSize,
      fontSize: Math.round(actionSize * 0.22),
    });
    const betButton = (label: string, title: string, shortcut: string) =>
      new Button({
        label,
        title,
        shortcut,
        width: 64,
        height: 64,
        fontSize: 34,
        color: colors.cyan,
      });
    this.betDown = betButton('−', betTitles[0], 'Arrow Down');
    this.betUp = betButton('+', betTitles[1], 'Arrow Up');
    this.betCaption = new Label(betCaption, 'caption');
    this.betCaption.anchor.set(0.5);
    this.panel = new BalancePanel(wallet, panelWidth);
    this.mute = new MuteButton(sounds);

    this.action.onPress = () => this.onAction?.();
    this.betDown.onPress = () => this.changeBet(-1);
    this.betUp.onPress = () => this.changeBet(1);

    this.addChild(
      this.title,
      this.message,
      this.action,
      this.betDown,
      this.betUp,
      this.betCaption,
      this.panel,
      this.mute,
    );
  }

  say(text: string, color: number = colors.muted): void {
    this.message.text = text;
    this.message.style.fill = color;
  }

  /** Bet buttons (and arrow keys) only work between rounds. */
  setBetting(enabled: boolean): void {
    this.betting = enabled;
    this.betDown.enabled = enabled;
    this.betUp.enabled = enabled;
  }

  /** Space and the arrow keys. Call from the scene's enter(); exit()/destroy() release them. */
  bindKeys(): void {
    this.unbindKeys();
    this.keyBindings = [
      onKey('Space', () => this.onAction?.()),
      onKey('ArrowUp', () => this.changeBet(1)),
      onKey('ArrowDown', () => this.changeBet(-1)),
    ];
  }

  unbindKeys(): void {
    this.keyBindings.forEach((unbind) => unbind());
    this.keyBindings = [];
  }

  /** Title at (x, y) with the message line under it. */
  placeHeader(x: number, y: number): void {
    this.title.position.set(x, y);
    this.message.position.set(x, y + MESSAGE_GAP);
  }

  /**
   * Action button at (x, y). Bet buttons go either side of it (`spread` apart), or underneath
   * it when `stacked`, with the caption below them.
   */
  placeControls(x: number, y: number, { spread = 135, stacked = false } = {}): void {
    this.action.position.set(x, y);
    const betY = stacked ? y + this.actionSize / 2 + 64 : y;
    const betSpread = stacked ? 50 : spread;
    this.betDown.position.set(x - betSpread, betY);
    this.betUp.position.set(x + betSpread, betY);
    this.betCaption.position.set(x, stacked ? betY + 48 : y + this.actionSize / 2 + 16);
  }

  /**
   * Stakes the current bet and asks the server for the round. `onStaked` runs once the bet is
   * taken, before the network wait, so the game can start animating. Only the server call is
   * guarded: a local error after the round settled must not be mistaken for a failed round.
   */
  async startRound<TOutcome>(
    server: OutcomeService<RoundRequest, TOutcome>,
    onStaked: () => void,
  ): Promise<RoundStart<TOutcome>> {
    const bet = this.wallet.bet;
    if (!this.wallet.debit(bet)) {
      this.say(
        this.wallet.topUp()
          ? `Free top-up: ${formatCredits(this.wallet.balance)} credits`
          : 'Not enough credits — lower your stake',
      );
      return { status: 'unaffordable' };
    }
    this.panel.clearWin();
    this.panel.hold();
    onStaked();

    const result = await server.play({ bet }).catch(() => null);
    if (!result) {
      this.wallet.credit(bet);
      this.say('Connection problem — your stake was refunded');
      return { status: 'failed' };
    }
    // The server has already settled the round, so credit now; the panel shows it later.
    this.wallet.credit(result.win);
    return { status: 'settled', result };
  }

  /** Counts a win up in the panel; resolves when done (or skipped). */
  async presentWin(win: number, multiplier: number): Promise<void> {
    if (win > 0) await this.panel.showWin(win, countUpSeconds(multiplier));
  }

  skipCountUp(): void {
    this.panel.skipCountUp();
  }

  /** Ends the round: the panel catches up with the real balance. */
  endRound(): void {
    this.panel.release();
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    this.unbindKeys();
    super.destroy(...args);
  }

  private changeBet(direction: 1 | -1) {
    if (!this.betting) return;
    this.wallet.stepBet(direction);
    this.sounds.play('click');
  }
}

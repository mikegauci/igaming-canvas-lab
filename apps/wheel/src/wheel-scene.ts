import {
  BalancePanel,
  Button,
  colors,
  countUpSeconds,
  formatCredits,
  Label,
  MuteButton,
  onKey,
  type OddsTable,
  Scene,
  StateMachine,
  type OutcomeService,
  type RoundResult,
  type SoundManager,
  type Viewport,
  type Wallet,
} from '@lab/core';
import type { Renderer, Ticker } from 'pixi.js';
import type { WheelOutcome, WheelRequest, WheelStats } from './logic/prizes';
import { createOddsTable } from './view/odds';
import { PrizeWheel, RADIUS } from './view/wheel';

type State = 'idle' | 'spinning' | 'landing' | 'presenting';
type Event = 'spin' | 'result' | 'failed' | 'landed' | 'done';

const SPIN_LABELS: Record<State, string> = {
  idle: 'SPIN',
  spinning: 'STOP',
  landing: 'STOP',
  presenting: 'SKIP',
};

export interface WheelSceneOptions {
  renderer: Renderer;
  stats: WheelStats;
  wallet: Wallet;
  sounds: SoundManager;
  server: OutcomeService<WheelRequest, WheelOutcome>;
}

const PANEL_WIDTH = 520;
/** Pointer ticks are throttled so a fast wheel buzzes rather than machine-guns. */
const MIN_TICK_GAP_MS = 45;

export class WheelScene extends Scene {
  private readonly wallet: Wallet;
  private readonly sounds: SoundManager;
  private readonly server: OutcomeService<WheelRequest, WheelOutcome>;

  private readonly round = new StateMachine<State, Event>('idle', {
    idle: { spin: 'spinning' },
    spinning: { result: 'landing', failed: 'landing' },
    landing: { landed: 'presenting' },
    presenting: { done: 'idle' },
  });

  private readonly title = new Label('LUCKY WHEEL', 'title', {
    dropShadow: { color: colors.neon, blur: 12, distance: 0, alpha: 0.9 },
  });
  private readonly message = new Label('', 'body', { fill: colors.muted });
  private readonly wheel: PrizeWheel;
  private readonly odds: OddsTable;
  private readonly panel: BalancePanel;
  private readonly mute: MuteButton;
  private readonly spinButton = new Button({
    label: SPIN_LABELS.idle,
    shortcut: 'Space',
    width: 130,
    height: 130,
    fontSize: 30,
  });
  private readonly betDown = new Button({
    label: '−',
    title: 'Lower bet',
    shortcut: 'Arrow Down',
    width: 64,
    height: 64,
    fontSize: 34,
    color: colors.cyan,
  });
  private readonly betUp = new Button({
    label: '+',
    title: 'Raise bet',
    shortcut: 'Arrow Up',
    width: 64,
    height: 64,
    fontSize: 34,
    color: colors.cyan,
  });
  private readonly betCaption = new Label('BET', 'caption');
  private keyBindings: (() => void)[] = [];
  private lastTick = 0;

  constructor({ renderer, stats, wallet, sounds, server }: WheelSceneOptions) {
    super();
    this.wallet = wallet;
    this.sounds = sounds;
    this.server = server;

    this.wheel = new PrizeWheel(renderer);
    this.wheel.onPeg = () => {
      const now = performance.now();
      if (now - this.lastTick < MIN_TICK_GAP_MS) return;
      this.lastTick = now;
      sounds.play('tick');
    };
    this.odds = createOddsTable(stats);
    this.panel = new BalancePanel(wallet, PANEL_WIDTH);
    this.mute = new MuteButton(sounds);

    this.title.anchor.set(0.5);
    this.message.anchor.set(0.5);
    this.betCaption.anchor.set(0.5);

    this.spinButton.onPress = () => this.onSpinPressed();
    this.betDown.onPress = () => this.changeBet(-1);
    this.betUp.onPress = () => this.changeBet(1);

    this.addChild(
      this.title,
      this.message,
      this.odds,
      this.wheel,
      this.spinButton,
      this.betDown,
      this.betUp,
      this.betCaption,
      this.panel,
      this.mute,
    );
    this.round.onChange(() => this.syncControls());
    this.say('Press SPIN or Space');
  }

  override update(ticker: Ticker): void {
    this.wheel.update(ticker);
  }

  override resize({ width, height, orientation }: Viewport): void {
    const table = this.odds.arrange(orientation === 'landscape' ? 1 : 2);

    if (orientation === 'landscape') {
      this.wheel.position.set(440, 375);
      const column = 970;
      this.title.position.set(column, 70);
      this.message.position.set(column, 114);
      this.odds.position.set(column - table.width / 2, 150);
      const controlsY = 150 + table.height + 90;
      this.spinButton.position.set(column, controlsY);
      this.betDown.position.set(column - 130, controlsY);
      this.betUp.position.set(column + 130, controlsY);
      this.betCaption.position.set(column, controlsY + 82);
      this.panel.position.set(column - PANEL_WIDTH / 2, height - 92);
      this.mute.position.set(width - 48, 44);
    } else {
      const cx = width / 2;
      this.title.position.set(cx, 70);
      this.message.position.set(cx, 116);
      this.wheel.position.set(cx, 170 + RADIUS + 40);
      const controlsY = this.wheel.y + RADIUS + 110;
      this.spinButton.position.set(cx, controlsY);
      this.betDown.position.set(cx - 170, controlsY);
      this.betUp.position.set(cx + 170, controlsY);
      this.betCaption.position.set(cx, controlsY + 82);
      this.odds.position.set(cx - table.width / 2, controlsY + 104);
      this.panel.position.set(cx - PANEL_WIDTH / 2, height - 100);
      this.mute.position.set(width - 50, 60);
    }
  }

  // Keys are live only while this is the current scene; destroy() covers teardown without exit.
  override enter(): void {
    this.unbindKeys();
    this.keyBindings = [
      onKey('Space', () => this.onSpinPressed()),
      onKey('ArrowUp', () => this.changeBet(1)),
      onKey('ArrowDown', () => this.changeBet(-1)),
    ];
  }

  override exit(): void {
    this.unbindKeys();
  }

  override destroy(...args: Parameters<Scene['destroy']>): void {
    this.unbindKeys();
    super.destroy(...args);
  }

  private unbindKeys() {
    this.keyBindings.forEach((unbind) => unbind());
    this.keyBindings = [];
  }

  private onSpinPressed() {
    switch (this.round.state) {
      case 'idle':
        void this.playRound();
        break;
      case 'spinning':
      case 'landing':
        this.wheel.hurry();
        break;
      case 'presenting':
        this.panel.skipCountUp();
        break;
    }
  }

  private changeBet(direction: 1 | -1) {
    if (this.round.state !== 'idle') return;
    this.wallet.stepBet(direction);
    this.sounds.play('click');
  }

  private async playRound() {
    const bet = this.wallet.bet;
    if (!this.wallet.debit(bet)) {
      if (this.wallet.topUp())
        this.say(`Free top-up: ${formatCredits(this.wallet.balance)} credits`);
      else this.say('Not enough credits — lower your bet');
      return;
    }

    this.round.send('spin');
    this.say('Good luck!');
    this.sounds.play('spin');
    this.panel.clearWin();
    this.panel.hold();
    this.wheel.startSpin();

    // Only the server call is guarded: a local error after the round settled must not be
    // mistaken for a failed round (and refund a bet that was already played).
    const result: RoundResult<WheelOutcome> | null = await this.server
      .play({ bet })
      .catch(() => null);

    if (result) {
      // The server has already settled the round, so credit now. The panel shows it later.
      this.wallet.credit(result.win);
      this.round.send('result');
      await this.wheel.land(result.outcome.segment, result.outcome.offset);
    } else {
      this.wallet.credit(bet);
      this.round.send('failed');
      // No result to show: just bring the wheel to rest on whatever comes round.
      await this.wheel.land(this.wheel.segmentUnderPointer, 0);
    }
    this.round.send('landed');

    if (!result) {
      this.say('Connection problem — your bet was refunded');
    } else if (result.win > 0) {
      const { multiplier, segment } = result.outcome;
      this.wheel.showWin(segment);
      this.sounds.play('win');
      this.say(multiplier === 1 ? 'Money back!' : `WIN ${formatCredits(result.win)}!`, colors.gold);
      await this.panel.showWin(result.win, countUpSeconds(multiplier));
    } else {
      this.sounds.play('miss');
      this.say('Missed — spin again?');
    }
    this.panel.release();
    this.round.send('done');
  }

  private syncControls() {
    const idle = this.round.state === 'idle';
    this.spinButton.text = SPIN_LABELS[this.round.state];
    this.betDown.enabled = idle;
    this.betUp.enabled = idle;
  }

  private say(text: string, color: number = colors.muted) {
    this.message.text = text;
    this.message.style.fill = color;
  }
}

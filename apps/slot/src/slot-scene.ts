import {
  BalancePanel,
  Button,
  colors,
  formatCredits,
  Label,
  MuteButton,
  onKey,
  Scene,
  StateMachine,
  type OutcomeService,
  type RoundResult,
  type SoundManager,
  type Viewport,
  type Wallet,
} from '@lab/core';
import type { Texture, Ticker } from 'pixi.js';
import { REEL_STRIPS, type SymbolId } from './logic/config';
import type { SpinOutcome, SpinRequest } from './logic/evaluate';
import { countUpSeconds } from './logic/presentation';
import type { SlotStats } from './logic/stats';
import { PaytablePanel } from './view/paytable';
import { SlotMachine } from './view/slot-machine';

type State = 'idle' | 'spinning' | 'landing' | 'presenting';
type Event = 'spin' | 'result' | 'failed' | 'landed' | 'done';

const SPIN_LABELS: Record<State, string> = {
  idle: 'SPIN',
  spinning: 'STOP',
  landing: 'STOP',
  presenting: 'SKIP',
};

export interface SlotSceneOptions {
  textures: Record<SymbolId, Texture>;
  stats: SlotStats;
  wallet: Wallet;
  sounds: SoundManager;
  server: OutcomeService<SpinRequest, SpinOutcome>;
}

const PANEL_WIDTH = 680;

export class SlotScene extends Scene {
  private readonly wallet: Wallet;
  private readonly sounds: SoundManager;
  private readonly server: OutcomeService<SpinRequest, SpinOutcome>;

  private readonly round = new StateMachine<State, Event>('idle', {
    idle: { spin: 'spinning' },
    spinning: { result: 'landing', failed: 'landing' },
    landing: { landed: 'presenting' },
    presenting: { done: 'idle' },
  });

  private readonly title = new Label('MINI SLOT', 'title', {
    dropShadow: { color: colors.neon, blur: 12, distance: 0, alpha: 0.9 },
  });
  private readonly message = new Label('', 'body', { fill: colors.muted });
  private readonly machine: SlotMachine;
  private readonly paytable: PaytablePanel;
  private readonly panel: BalancePanel;
  private readonly mute: MuteButton;
  private readonly spinButton = new Button({
    label: SPIN_LABELS.idle,
    shortcut: 'Space',
    width: 150,
    height: 150,
    fontSize: 34,
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
  /** Last result shown, so a failed round can land the reels back where they were. */
  private lastStops = REEL_STRIPS.map(() => 0);
  private keyBindings: (() => void)[] = [];

  constructor({ textures, stats, wallet, sounds, server }: SlotSceneOptions) {
    super();
    this.wallet = wallet;
    this.sounds = sounds;
    this.server = server;

    this.machine = new SlotMachine(textures, this.lastStops);
    this.machine.onReelStop = () => sounds.play('stop');
    this.paytable = new PaytablePanel(textures, stats);
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
      this.paytable,
      this.machine,
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
    this.machine.update(ticker);
  }

  override resize({ width, height, orientation }: Viewport): void {
    const cx = width / 2;
    const table = this.paytable.arrange(orientation);

    if (orientation === 'landscape') {
      this.title.position.set(cx, 44);
      this.message.position.set(cx, 86);
      this.machine.position.set(cx - SlotMachine.WIDTH / 2 - 20, 112);
      const machineMid = this.machine.y + SlotMachine.HEIGHT / 2;
      this.paytable.position.set(this.machine.x - table.width - 32, machineMid - table.height / 2);
      const side = this.machine.x + SlotMachine.WIDTH + 140;
      this.spinButton.position.set(side, machineMid - 40);
      this.betDown.position.set(side - 50, machineMid + 100);
      this.betUp.position.set(side + 50, machineMid + 100);
      this.betCaption.position.set(side, machineMid + 148);
      this.panel.position.set(cx - PANEL_WIDTH / 2, height - 96);
      this.mute.position.set(width - 48, 44);
    } else {
      this.title.position.set(cx, 70);
      this.message.position.set(cx, 120);
      this.machine.position.set(cx - SlotMachine.WIDTH / 2, 160);
      const controlsY = this.machine.y + SlotMachine.HEIGHT + 120;
      this.spinButton.position.set(cx, controlsY);
      this.betDown.position.set(cx - 180, controlsY);
      this.betUp.position.set(cx + 180, controlsY);
      this.betCaption.position.set(cx, controlsY + 96);
      this.paytable.position.set(cx - table.width / 2, controlsY + 130);
      this.panel.position.set(cx - PANEL_WIDTH / 2, height - 110);
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
        this.machine.slam();
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
    this.machine.spin();

    // Only the server call is guarded: a local error after the round settled must not be
    // mistaken for a failed round (and refund a bet that was already played).
    const result: RoundResult<SpinOutcome> | null = await this.server
      .play({ bet })
      .catch(() => null);

    if (result) {
      // The server has already settled the round, so credit now. The panel shows it later.
      this.wallet.credit(result.win);
      this.round.send('result');
    } else {
      this.wallet.credit(bet);
      this.round.send('failed');
    }
    const outcome = result?.outcome ?? null;
    const win = result?.win ?? 0;

    await this.machine.stop(outcome?.stops ?? this.lastStops);
    this.round.send('landed');

    if (!outcome) {
      this.say('Connection problem — your bet was refunded');
    } else {
      this.lastStops = outcome.stops;
      if (win > 0) {
        this.machine.showWins(outcome.wins);
        this.sounds.play('win');
        this.say(`WIN ${formatCredits(win)}!`, colors.gold);
        await this.panel.showWin(win, countUpSeconds(win / bet));
      } else {
        this.say('No win this time');
      }
    }
    this.panel.release();
    this.round.send('done');
  }

  private syncControls() {
    const state = this.round.state;
    const idle = state === 'idle';
    this.spinButton.text = SPIN_LABELS[state];
    this.betDown.enabled = idle;
    this.betUp.enabled = idle;
  }

  private say(text: string, color: number = colors.muted) {
    this.message.text = text;
    this.message.style.fill = color;
  }
}

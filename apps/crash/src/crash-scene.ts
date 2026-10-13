import {
  Button,
  colors,
  formatCredits,
  GameHud,
  onKey,
  Scene,
  StateMachine,
  type SoundManager,
  type Viewport,
  type Wallet,
} from '@lab/core';
import type { Renderer, Ticker } from 'pixi.js';
import { AUTO_TARGETS, multiplierAt, toCents, type AutoTarget } from './logic/crash';
import type { MockCrashServer } from './logic/server';
import { CrashChart } from './view/chart';
import { HistoryBar } from './view/history';

type State = 'idle' | 'starting' | 'flying' | 'cashing' | 'cashed' | 'crashed';
type Event = 'bet' | 'launched' | 'failed' | 'cashOut' | 'paid' | 'missed' | 'crash' | 'reset';

const ACTION_LABELS: Record<State, string> = {
  idle: 'BET',
  starting: '…',
  flying: 'CASH OUT',
  cashing: '…',
  cashed: 'CASHED',
  crashed: '…',
};

/** Multipliers that get a chime as the rocket passes them. */
const MILESTONES = [2, 5, 10, 20, 50, 100];
/** Pause on the result before the next bet can be placed. */
const RESULT_PAUSE_MS = 1400;

export interface CrashSceneOptions {
  renderer: Renderer;
  wallet: Wallet;
  sounds: SoundManager;
  server: MockCrashServer;
}

export class CrashScene extends Scene {
  private readonly wallet: Wallet;
  private readonly sounds: SoundManager;
  private readonly server: MockCrashServer;
  private readonly round = new StateMachine<State, Event>('idle', {
    idle: { bet: 'starting' },
    // An instant bust can be pushed before the start acknowledgement arrives.
    starting: { launched: 'flying', failed: 'idle', crash: 'crashed' },
    flying: { cashOut: 'cashing', paid: 'cashed', crash: 'crashed' },
    // A missed cash-out means the crash is already on its way: keep waiting for it.
    cashing: { paid: 'cashed', missed: 'cashing', crash: 'crashed' },
    cashed: { crash: 'crashed' },
    crashed: { reset: 'idle' },
  });
  private readonly hud: GameHud;
  private readonly chart: CrashChart;
  private readonly history = new HistoryBar(7);
  private readonly autoButton = new Button({
    label: 'AUTO: OFF',
    title: 'Auto cash-out target',
    shortcut: 'A',
    width: 200,
    height: 52,
    fontSize: 20,
    color: colors.cyan,
  });
  private autoIndex = 0;
  private roundId: string | null = null;
  private bet = 0;
  private won = false;
  private elapsed = 0;
  private nextMilestone = 0;
  private unbindAuto: (() => void) | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor({ renderer, wallet, sounds, server }: CrashSceneOptions) {
    super();
    this.wallet = wallet;
    this.sounds = sounds;
    this.server = server;

    this.hud = new GameHud({
      title: 'CRASH',
      wallet,
      sounds,
      actionLabel: ACTION_LABELS.idle,
      actionSize: 96,
      actionWidth: 220,
      panelWidth: 400,
    });
    this.hud.onAction = () => this.onAction();
    this.chart = new CrashChart(renderer, 820, 470);
    this.autoButton.onPress = () => this.cycleAuto();

    this.addChild(this.chart, this.history, this.autoButton, this.hud);
    this.round.onChange((state) => {
      this.hud.action.text = ACTION_LABELS[state];
      this.hud.action.enabled = state === 'idle' || state === 'flying';
      this.hud.setBetting(state === 'idle');
      this.autoButton.enabled = state === 'idle';
    });
    this.chart.setCaption('PLACE A BET TO LAUNCH');
    this.hud.say('Cash out before it crashes');
  }

  override update(ticker: Ticker): void {
    // elapsedMS is the real time since the last frame (deltaMS is capped), so the climb stays
    // in step with the server's clock even after a slow frame.
    const seconds = ticker.elapsedMS / 1000;
    const state = this.round.state;
    if (state === 'flying' || state === 'cashing' || state === 'cashed') {
      this.elapsed += seconds;
      this.chart.setElapsed(this.elapsed);
      const multiplier = toCents(multiplierAt(this.elapsed));
      if (state !== 'cashed') {
        this.chart.setCaption(
          `PAYOUT ${formatCredits(Math.floor(this.bet * multiplier))}`,
          colors.gold,
        );
      }
      while (
        this.nextMilestone < MILESTONES.length &&
        multiplier >= MILESTONES[this.nextMilestone]!
      ) {
        this.nextMilestone++;
        this.sounds.play('milestone');
      }
    }
    this.chart.update(seconds);
  }

  override resize({ width, height, orientation }: Viewport): void {
    const { hud } = this;
    if (orientation === 'landscape') {
      this.chart.setSize(820, 470);
      this.chart.position.set(40, 96);
      this.history.position.set(48, 582);
      const column = 1062;
      hud.placeHeader(column, 70);
      hud.placeControls(column, 290, { spread: 150 });
      this.autoButton.position.set(column, 410);
      hud.panel.position.set(column - hud.panelWidth / 2, height - 92);
      hud.mute.position.set(width - 48, 44);
      hud.music.position.set(width - 116, 44);
    } else {
      const cx = width / 2;
      hud.placeHeader(cx, 70);
      this.chart.setSize(680, 480);
      this.chart.position.set(20, 150);
      this.history.position.set(28, 648);
      hud.placeControls(cx, 780, { spread: 190 });
      this.autoButton.position.set(cx, 900);
      hud.panel.position.set(cx - hud.panelWidth / 2, height - 100);
      hud.mute.position.set(width - 50, 60);
      hud.music.position.set(width - 118, 60);
    }
  }

  override enter(): void {
    this.hud.bindKeys();
    this.unbindAuto?.();
    this.unbindAuto = onKey('KeyA', () => this.cycleAuto());
  }

  override exit(): void {
    this.hud.unbindKeys();
    this.unbindAuto?.();
    this.unbindAuto = null;
  }

  override destroy(...args: Parameters<Scene['destroy']>): void {
    this.exit();
    if (this.resetTimer) clearTimeout(this.resetTimer);
    super.destroy(...args);
  }

  private get autoTarget(): AutoTarget {
    return AUTO_TARGETS[this.autoIndex]!;
  }

  private cycleAuto() {
    if (this.round.state !== 'idle') return;
    this.autoIndex = (this.autoIndex + 1) % AUTO_TARGETS.length;
    const target = this.autoTarget;
    this.autoButton.text = target === null ? 'AUTO: OFF' : `AUTO: ${target.toFixed(2)}×`;
    this.sounds.play('click');
  }

  private onAction() {
    if (this.round.state === 'idle') void this.placeBet();
    else if (this.round.state === 'flying') void this.cashOut();
  }

  private async placeBet() {
    // A new bet ends any win count-up still running from the last round.
    this.hud.skipCountUp();
    const bet = this.wallet.bet;
    if (!this.wallet.debit(bet)) {
      this.hud.say(
        this.wallet.topUp()
          ? `Free top-up: ${formatCredits(this.wallet.balance)} credits`
          : 'Not enough credits — lower your stake',
      );
      return;
    }
    this.round.send('bet');
    this.bet = bet;
    this.won = false;
    this.hud.panel.clearWin();
    this.sounds.play('bet');
    this.hud.say('Launching…');

    try {
      const { roundId } = await this.server.start(
        bet,
        {
          onCrash: (point) => this.onCrash(point),
          onCashOut: ({ multiplier, win }) => void this.onPaid(multiplier, win),
        },
        this.autoTarget,
      );
      if (this.destroyed) return;
      this.roundId = roundId;
      // Busted at 1.00× before the acknowledgement got here: onCrash already showed it.
      if (this.round.state !== 'starting') return;
    } catch {
      this.wallet.credit(bet);
      this.round.send('failed');
      this.hud.say('Connection problem — your stake was refunded');
      return;
    }

    this.elapsed = 0;
    this.nextMilestone = 0;
    this.chart.launch();
    this.round.send('launched');
    this.sounds.play('launch');
    const auto = this.autoTarget;
    this.hud.say(
      auto === null ? 'Cash out before it crashes!' : `Auto cash-out at ${auto.toFixed(2)}×`,
    );
  }

  private async cashOut() {
    if (!this.roundId || !this.round.send('cashOut')) return;
    this.hud.say('Cashing out…');
    const verdict = await this.server.cashOut(this.roundId);
    if (this.destroyed) return;
    if (verdict.cashedOut) void this.onPaid(verdict.multiplier, verdict.win);
    else {
      this.round.send('missed');
      this.hud.say('Too late — the server saw the crash first', 0xff3e5e);
    }
  }

  private async onPaid(multiplier: number, win: number) {
    if (this.destroyed || this.won) return;
    // The server's verdict is final even if its crash message overtook this one on the way:
    // always credit a confirmed cash-out.
    this.won = true;
    this.round.send('paid');
    this.chart.markCashOut(multiplier);
    if (multiplier >= 2) this.hud.unlock('crash-2x');
    this.chart.setCaption(`CASHED ${formatCredits(win)}`, colors.gold);
    this.sounds.play('cashout');
    this.hud.say(
      `Cashed out at ${multiplier.toFixed(2)}× — WIN ${formatCredits(win)}!`,
      colors.gold,
    );
    this.hud.panel.hold();
    this.wallet.credit(win);
    await this.hud.presentWin(win, multiplier);
    this.hud.endRound();
  }

  private onCrash(point: number) {
    if (this.destroyed) return;
    if (this.round.state === 'starting') this.chart.launch();
    this.round.send('crash');
    this.chart.crash(point);
    this.history.push(point);
    this.sounds.play('crash');
    if (!this.won) {
      this.chart.setCaption(`CRASHED @ ${point.toFixed(2)}×`, 0xff3e5e);
      this.hud.say(`Crashed at ${point.toFixed(2)}× — better luck next round`, 0xff3e5e);
    }
    this.roundId = null;
    this.resetTimer = setTimeout(() => {
      this.resetTimer = null;
      this.round.send('reset');
      if (!this.won) this.chart.setCaption('PLACE A BET TO LAUNCH');
    }, RESULT_PAUSE_MS);
  }
}

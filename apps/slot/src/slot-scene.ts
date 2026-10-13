import {
  colors,
  formatCredits,
  GameHud,
  Scene,
  StateMachine,
  type OutcomeService,
  type SoundManager,
  type Viewport,
  type Wallet,
} from '@lab/core';
import type { Texture, Ticker } from 'pixi.js';
import { REEL_STRIPS, type SymbolId } from './logic/config';
import type { SpinOutcome, SpinRequest } from './logic/evaluate';
import type { SlotStats } from './logic/stats';
import { PaytablePanel } from './view/paytable';
import { SlotMachine } from './view/slot-machine';
import { SlotCabinet } from './view/cabinet';

type State = 'idle' | 'spinning' | 'landing' | 'presenting';
type Event = 'spin' | 'result' | 'failed' | 'landed' | 'done';

const ACTION_LABELS: Record<State, string> = {
  idle: 'SPIN',
  spinning: 'STOP',
  landing: 'STOP',
  presenting: 'SKIP',
};

export interface SlotSceneOptions {
  artwork: Texture;
  textures: Record<SymbolId, Texture>;
  stats: SlotStats;
  wallet: Wallet;
  sounds: SoundManager;
  server: OutcomeService<SpinRequest, SpinOutcome>;
}

export class SlotScene extends Scene {
  private readonly sounds: SoundManager;
  private readonly server: OutcomeService<SpinRequest, SpinOutcome>;
  private readonly round = new StateMachine<State, Event>('idle', {
    idle: { spin: 'spinning' },
    spinning: { result: 'landing', failed: 'landing' },
    landing: { landed: 'presenting' },
    presenting: { done: 'idle' },
  });
  private readonly hud: GameHud;
  private readonly machine: SlotMachine;
  private readonly paytable: PaytablePanel;
  private readonly cabinet: SlotCabinet;
  /** Last result shown, so a failed round can land the reels back where they were. */
  private lastStops = REEL_STRIPS.map(() => 0);

  constructor({ artwork, textures, stats, wallet, sounds, server }: SlotSceneOptions) {
    super();
    this.sounds = sounds;
    this.server = server;

    this.hud = new GameHud({
      title: 'MINI SLOT',
      wallet,
      sounds,
      actionLabel: ACTION_LABELS.idle,
      actionSize: 124,
      panelWidth: SlotMachine.WIDTH,
      appearance: 'arcade',
    });
    this.hud.onAction = () => this.onAction();
    this.machine = new SlotMachine(textures, this.lastStops);
    this.machine.onReelStop = () => sounds.play('stop');
    this.paytable = new PaytablePanel(textures, stats);
    this.cabinet = new SlotCabinet(artwork);
    this.hud.message.style.fontSize = 16;
    this.hud.message.style.wordWrap = true;
    this.hud.message.style.align = 'center';
    this.hud.message.style.fill = 0xd5d3e8;
    this.hud.betCaption.style.fontSize = 11;
    this.hud.betCaption.text = 'TOTAL BET';

    this.addChild(this.cabinet, this.paytable, this.machine, this.hud);
    this.round.onChange((state) => {
      this.hud.action.text = ACTION_LABELS[state];
      this.hud.setBetting(state === 'idle');
    });
    this.hud.say('Ready when you are');
  }

  override update(ticker: Ticker): void {
    this.machine.update(ticker);
    this.cabinet.update(ticker.deltaMS / 1000);
  }

  override resize(viewport: Viewport): void {
    const { width, height, orientation } = viewport;
    const { hud } = this;
    const cx = width / 2;
    const table = this.paytable.arrange(orientation);
    hud.message.style.wordWrapWidth = orientation === 'landscape' ? 232 : SlotMachine.WIDTH;
    hud.betCaption.visible = orientation === 'landscape';

    if (orientation === 'landscape') {
      this.machine.position.set(cx - SlotMachine.WIDTH / 2, 188);
      hud.placeHeader(cx, 95);
      hud.message.position.set(1060, 217);
      const machineMid = this.machine.y + SlotMachine.HEIGHT / 2;
      this.paytable.position.set(this.machine.x - table.width - 30, machineMid - table.height / 2);
      hud.placeControls(1060, 339, {
        stacked: true,
      });
      hud.panel.position.set(cx - hud.panelWidth / 2, height - 84);
      hud.mute.position.set(width - 54, 44);
    } else {
      hud.placeHeader(cx, 143);
      this.machine.position.set(cx - SlotMachine.WIDTH / 2, 238);
      hud.message.position.set(cx, 212);
      const controlsY = this.machine.y + 552;
      hud.placeControls(cx, controlsY, { spread: 207 });
      hud.betCaption.position.set(cx, controlsY + 61);
      hud.panel.position.set(cx - hud.panelWidth / 2, 906);
      this.paytable.position.set(cx - table.width / 2, 1014);
      hud.mute.position.set(width - 57, 51);
    }
    this.cabinet.arrange(viewport, this.machine.x, this.machine.y, SlotMachine.WIDTH);
  }

  override enter(): void {
    this.hud.bindKeys();
  }

  override exit(): void {
    this.hud.unbindKeys();
  }

  private onAction() {
    switch (this.round.state) {
      case 'idle':
        void this.playRound();
        break;
      case 'spinning':
      case 'landing':
        this.machine.slam();
        break;
      case 'presenting':
        this.hud.skipCountUp();
        break;
    }
  }

  private async playRound() {
    const start = await this.hud.startRound(this.server, () => {
      this.round.send('spin');
      this.hud.say('Good luck!');
      this.sounds.play('spin');
      this.machine.spin();
    });
    if (start.status === 'unaffordable') return;

    this.round.send(start.status === 'settled' ? 'result' : 'failed');
    const outcome = start.status === 'settled' ? start.result.outcome : null;
    await this.machine.stop(outcome?.stops ?? this.lastStops);
    this.round.send('landed');

    if (start.status === 'settled') {
      const { outcome, win, bet } = start.result;
      this.lastStops = outcome.stops;
      this.hud.unlock('slot-spin');
      if (win > 0) {
        this.machine.showWins(outcome.wins);
        this.sounds.play('win');
        this.hud.say(`WIN ${formatCredits(win)}!`, colors.gold);
        await this.hud.presentWin(win, win / bet);
      } else {
        this.hud.say('No win this time');
      }
    }
    this.hud.endRound();
    this.round.send('done');
  }
}

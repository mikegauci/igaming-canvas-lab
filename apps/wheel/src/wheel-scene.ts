import {
  colors,
  formatCredits,
  GameHud,
  Scene,
  StateMachine,
  type OddsTable,
  type OutcomeService,
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

const ACTION_LABELS: Record<State, string> = {
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

/** Pointer ticks are throttled so a fast wheel buzzes rather than machine-guns. */
const MIN_TICK_GAP_MS = 45;

export class WheelScene extends Scene {
  private readonly sounds: SoundManager;
  private readonly server: OutcomeService<WheelRequest, WheelOutcome>;
  private readonly round = new StateMachine<State, Event>('idle', {
    idle: { spin: 'spinning' },
    spinning: { result: 'landing', failed: 'landing' },
    landing: { landed: 'presenting' },
    presenting: { done: 'idle' },
  });
  private readonly hud: GameHud;
  private readonly wheel: PrizeWheel;
  private readonly odds: OddsTable;
  private lastTick = 0;

  constructor({ renderer, stats, wallet, sounds, server }: WheelSceneOptions) {
    super();
    this.sounds = sounds;
    this.server = server;

    this.hud = new GameHud({
      title: 'LUCKY WHEEL',
      wallet,
      sounds,
      actionLabel: ACTION_LABELS.idle,
      actionSize: 130,
    });
    this.hud.onAction = () => this.onAction();
    this.wheel = new PrizeWheel(renderer);
    this.wheel.onPeg = () => {
      const now = performance.now();
      if (now - this.lastTick < MIN_TICK_GAP_MS) return;
      this.lastTick = now;
      sounds.play('tick');
    };
    this.odds = createOddsTable(stats);

    this.addChild(this.odds, this.wheel, this.hud);
    this.round.onChange((state) => {
      this.hud.action.text = ACTION_LABELS[state];
      this.hud.setBetting(state === 'idle');
    });
    this.hud.say('Press SPIN or Space');
  }

  override update(ticker: Ticker): void {
    this.wheel.update(ticker);
  }

  override resize({ width, height, orientation }: Viewport): void {
    const { hud } = this;
    if (orientation === 'landscape') {
      const table = this.odds.arrange(1);
      const column = 970;
      this.wheel.position.set(440, 375);
      hud.placeHeader(column, 70);
      this.odds.position.set(column - table.width / 2, 150);
      hud.placeControls(column, 150 + table.height + 90, { spread: 130 });
      hud.panel.position.set(column - hud.panelWidth / 2, height - 92);
      hud.mute.position.set(width - 48, 44);
    } else {
      const table = this.odds.arrange(2);
      const cx = width / 2;
      hud.placeHeader(cx, 70);
      this.wheel.position.set(cx, 170 + RADIUS + 40);
      const controlsY = this.wheel.y + RADIUS + 110;
      hud.placeControls(cx, controlsY, { spread: 170 });
      this.odds.position.set(cx - table.width / 2, controlsY + 104);
      hud.panel.position.set(cx - hud.panelWidth / 2, height - 100);
      hud.mute.position.set(width - 50, 60);
    }
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
        this.wheel.hurry();
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
      this.wheel.startSpin();
    });
    if (start.status === 'unaffordable') return;

    if (start.status === 'settled') {
      this.round.send('result');
      await this.wheel.land(start.result.outcome.segment, start.result.outcome.offset);
    } else {
      this.round.send('failed');
      // No result to show: bring the wheel to rest on whatever comes round.
      await this.wheel.land(this.wheel.segmentUnderPointer, 0);
    }
    this.round.send('landed');

    if (start.status === 'settled') {
      const { outcome, win } = start.result;
      if (win > 0) {
        this.hud.unlock('wheel-win');
        this.wheel.showWin(outcome.segment);
        this.sounds.play('win');
        this.hud.say(
          outcome.multiplier === 1 ? 'Money back!' : `WIN ${formatCredits(win)}!`,
          colors.gold,
        );
        await this.hud.presentWin(win, outcome.multiplier);
      } else {
        this.sounds.play('miss');
        this.hud.say('Missed — spin again?');
      }
    }
    this.hud.endRound();
    this.round.send('done');
  }
}

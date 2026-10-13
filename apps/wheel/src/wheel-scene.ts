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
import type { Renderer, Texture, Ticker } from 'pixi.js';
import type { WheelOutcome, WheelRequest, WheelStats } from './logic/prizes';
import { PrizeOddsPanel } from './view/odds';
import { PrizeWheel } from './view/wheel';
import { WheelCabinet } from './view/cabinet';

type State = 'idle' | 'spinning' | 'landing' | 'presenting';
type Event = 'spin' | 'result' | 'failed' | 'landed' | 'done';

const ACTION_LABELS: Record<State, string> = {
  idle: 'SPIN',
  spinning: 'STOP',
  landing: 'STOP',
  presenting: 'SKIP',
};

export interface WheelSceneOptions {
  artwork: Texture;
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
  private readonly odds: PrizeOddsPanel;
  private readonly cabinet: WheelCabinet;
  private lastTick = 0;

  constructor({ artwork, renderer, stats, wallet, sounds, server }: WheelSceneOptions) {
    super();
    this.sounds = sounds;
    this.server = server;

    this.hud = new GameHud({
      title: 'LUCKY WHEEL',
      wallet,
      sounds,
      actionLabel: ACTION_LABELS.idle,
      actionSize: 124,
      panelWidth: 560,
      appearance: 'arcade',
    });
    this.hud.onAction = () => this.onAction();
    this.wheel = new PrizeWheel(renderer);
    this.wheel.onPeg = () => {
      const now = performance.now();
      if (now - this.lastTick < MIN_TICK_GAP_MS) return;
      this.lastTick = now;
      sounds.play('tick');
    };
    this.odds = new PrizeOddsPanel(stats);
    this.cabinet = new WheelCabinet(artwork);
    this.hud.message.style.fontSize = 16;
    this.hud.message.style.wordWrap = true;
    this.hud.message.style.align = 'center';
    this.hud.betCaption.style.fontSize = 11;
    this.hud.betCaption.text = 'TOTAL BET';

    this.addChild(this.cabinet, this.odds, this.wheel, this.hud);
    this.round.onChange((state) => {
      this.hud.action.text = ACTION_LABELS[state];
      this.hud.setBetting(state === 'idle');
    });
    this.hud.say('Ready when you are');
  }

  override update(ticker: Ticker): void {
    this.wheel.update(ticker);
    this.cabinet.update(ticker.deltaMS / 1000);
  }

  override resize(viewport: Viewport): void {
    const { width, height, orientation } = viewport;
    const { hud } = this;
    const cx = width / 2;
    const table = this.odds.arrange(orientation);
    hud.message.style.wordWrapWidth = orientation === 'landscape' ? 232 : 560;
    hud.betCaption.visible = orientation === 'landscape';
    if (orientation === 'landscape') {
      this.wheel.position.set(cx, 395);
      this.wheel.scale.set(0.76);
      hud.placeHeader(cx, 95);
      hud.message.position.set(1060, 217);
      this.odds.position.set(83, 395 - table.height / 2);
      hud.placeControls(1060, 339, { stacked: true });
      hud.panel.position.set(cx - hud.panelWidth / 2, height - 84);
      hud.mute.position.set(width - 54, 44);
      hud.music.position.set(width - 122, 44);
    } else {
      hud.placeHeader(cx, 143);
      hud.message.position.set(cx, 212);
      this.wheel.position.set(cx, 483);
      this.wheel.scale.set(0.86);
      hud.placeControls(cx, 846, { spread: 207 });
      hud.panel.position.set(cx - hud.panelWidth / 2, 956);
      this.odds.position.set(cx - table.width / 2, 1050);
      hud.mute.position.set(width - 57, 51);
      hud.music.position.set(width - 125, 51);
    }
    this.cabinet.arrange(viewport, this.wheel.x, this.wheel.y);
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

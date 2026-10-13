import {
  colors,
  Confetti,
  formatCredits,
  GameHud,
  Scene,
  StateMachine,
  type OutcomeService,
  type RoundResult,
  type SoundManager,
  type Viewport,
  type Wallet,
} from '@lab/core';
import { Point, type Renderer, type Texture, type Ticker } from 'pixi.js';
import {
  CELLS,
  winningCells,
  type CardOutcome,
  type CardRequest,
  type CardStats,
} from './logic/card';
import { ScratchCabinet } from './view/cabinet';
import { CARD_HEIGHT, CARD_WIDTH, ScratchCard } from './view/card';
import { PrizeOddsPanel } from './view/odds';

type State = 'idle' | 'buying' | 'scratching' | 'revealing' | 'presenting';
type Event = 'buy' | 'dealt' | 'failed' | 'finish' | 'revealed' | 'done';

const ACTION_LABELS: Record<State, string> = {
  idle: 'BUY',
  buying: '…',
  scratching: 'REVEAL',
  revealing: 'REVEAL',
  presenting: 'SKIP',
};

/** A prize counts as seen once this much of its cell is scratched. */
const CELL_REVEALED = 0.5;
/** Past this much of the whole card, the rest is wiped away automatically. */
const AUTO_FINISH = 0.62;
const SCRATCH_SOUND_GAP_MS = 80;
const FOIL_FLAKES = [0xdfe6f5, 0xaab3c9, 0xa1f8ff, 0xff8bd0];

export interface ScratchSceneOptions {
  artwork: Texture;
  renderer: Renderer;
  stats: CardStats;
  wallet: Wallet;
  sounds: SoundManager;
  server: OutcomeService<CardRequest, CardOutcome>;
}

export class ScratchScene extends Scene {
  private readonly sounds: SoundManager;
  private readonly server: OutcomeService<CardRequest, CardOutcome>;
  private readonly round = new StateMachine<State, Event>('idle', {
    idle: { buy: 'buying' },
    buying: { dealt: 'scratching', failed: 'idle' },
    scratching: { finish: 'revealing' },
    revealing: { revealed: 'presenting' },
    presenting: { done: 'idle' },
  });
  private readonly hud: GameHud;
  private readonly card: ScratchCard;
  private readonly odds: PrizeOddsPanel;
  private readonly cabinet: ScratchCabinet;
  private readonly confetti = new Confetti();
  private result: RoundResult<CardOutcome> | null = null;
  private lastScratchSound = 0;

  constructor({ artwork, renderer, stats, wallet, sounds, server }: ScratchSceneOptions) {
    super();
    this.sounds = sounds;
    this.server = server;

    this.hud = new GameHud({
      title: 'SCRATCH CARD',
      wallet,
      sounds,
      actionLabel: ACTION_LABELS.idle,
      betCaption: 'CARD PRICE',
      betTitles: ['Cheaper card', 'Pricier card'],
      actionSize: 124,
      panelWidth: 560,
      appearance: 'arcade',
    });
    this.hud.onAction = () => this.onAction();
    this.card = new ScratchCard(renderer);
    this.card.onScratch = (added, at) => this.onScratch(added, at);
    this.odds = new PrizeOddsPanel(stats);
    this.cabinet = new ScratchCabinet(artwork);
    this.hud.message.style.fontSize = 16;
    this.hud.message.style.wordWrap = true;
    this.hud.message.style.align = 'center';
    this.hud.betCaption.style.fontSize = 11;

    this.addChild(this.cabinet, this.odds, this.card, this.hud, this.confetti);
    this.round.onChange((state) => {
      this.hud.action.text = ACTION_LABELS[state];
      this.hud.action.enabled = state !== 'buying' && state !== 'revealing';
      this.hud.setBetting(state === 'idle');
    });
    this.hud.say('Buy a card, then scratch it');
  }

  override update(ticker: Ticker): void {
    this.confetti.tick(ticker.deltaMS / 1000);
    this.cabinet.update(ticker.deltaMS / 1000);
  }

  override resize(viewport: Viewport): void {
    const { width, height, orientation } = viewport;
    const { hud, card } = this;
    const cx = width / 2;
    const table = this.odds.arrange(orientation);
    hud.message.style.wordWrapWidth = orientation === 'landscape' ? 232 : 560;
    hud.betCaption.visible = orientation === 'landscape';
    // The card is drawn at full size and scaled to sit in the cabinet like the wheel does.
    const scale = orientation === 'landscape' ? 0.75 : 0.86;
    const centerY = orientation === 'landscape' ? 398 : 488;
    card.scale.set(scale);
    card.position.set(cx - (CARD_WIDTH * scale) / 2, centerY - (CARD_HEIGHT * scale) / 2);
    if (orientation === 'landscape') {
      hud.placeHeader(cx, 95);
      hud.message.position.set(1060, 217);
      this.odds.position.set(83, centerY - table.height / 2);
      hud.placeControls(1060, 339, { stacked: true });
      hud.panel.position.set(cx - hud.panelWidth / 2, height - 84);
      hud.mute.position.set(width - 54, 44);
    } else {
      hud.placeHeader(cx, 143);
      hud.message.position.set(cx, 212);
      hud.placeControls(cx, 846, { spread: 207 });
      hud.panel.position.set(cx - hud.panelWidth / 2, 956);
      this.odds.position.set(cx - table.width / 2, 1050);
      hud.mute.position.set(width - 57, 51);
    }
    this.cabinet.arrange(viewport, cx, card.y + CARD_HEIGHT * scale);
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
        void this.buy();
        break;
      case 'scratching':
        void this.finish();
        break;
      case 'presenting':
        this.hud.skipCountUp();
        break;
      default:
        break;
    }
  }

  private async buy() {
    const start = await this.hud.startRound(this.server, () => {
      this.round.send('buy');
      this.sounds.play('buy');
      this.confetti.reset();
    });
    if (start.status === 'unaffordable') return;
    if (start.status === 'failed') {
      this.hud.endRound();
      this.round.send('failed');
      return;
    }

    this.result = start.result;
    this.card.deal(start.result.outcome.cells);
    this.card.enabled = true;
    this.round.send('dealt');
    this.hud.say('Scratch away — or press REVEAL');
  }

  private onScratch(added: number, at: Point) {
    if (added === 0 || this.round.state !== 'scratching') return;
    const spot = this.toLocal(at, this.card);
    this.confetti.burst({
      x: spot.x,
      y: spot.y,
      count: 2,
      angle: Math.PI / 2,
      spread: Math.PI,
      speed: [40, 160],
      size: 6,
      gravity: 900,
      life: 0.7,
      palette: FOIL_FLAKES,
    });
    const now = performance.now();
    if (now - this.lastScratchSound > SCRATCH_SOUND_GAP_MS) {
      this.lastScratchSound = now;
      this.sounds.play('scratch');
    }

    let revealed = 0;
    for (let i = 0; i < CELLS; i++) if (this.card.cellCoverage(i) >= CELL_REVEALED) revealed++;
    if (revealed === CELLS || this.card.grid.coverage >= AUTO_FINISH) void this.finish();
  }

  private async finish() {
    if (!this.round.send('finish') || !this.result) return;
    const { outcome, win } = this.result;
    this.sounds.play('reveal');
    await this.card.revealAll();
    this.round.send('revealed');

    if (outcome.prize === null) {
      this.sounds.play('miss');
      this.hud.say('No match this time — try another card');
    } else {
      this.card.highlight(winningCells(outcome.cells));
      this.hud.unlock('scratch-match');
      this.sounds.play('win');
      this.hud.say(`THREE ×${outcome.prize} — WIN ${formatCredits(win)}!`, colors.gold);
      const center = this.toLocal(new Point(CARD_WIDTH / 2, CARD_HEIGHT * 0.45), this.card);
      this.confetti.burst({
        x: center.x,
        y: center.y,
        count: Math.round(70 + 40 * Math.log2(outcome.prize + 1)),
      });
      await this.hud.presentWin(win, outcome.prize);
    }
    this.hud.endRound();
    this.round.send('done');
  }
}

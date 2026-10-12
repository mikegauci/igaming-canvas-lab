import {
  colors,
  Confetti,
  formatCredits,
  GameHud,
  OddsTable,
  Scene,
  StateMachine,
  type OutcomeService,
  type RoundResult,
  type SoundManager,
  type Viewport,
  type Wallet,
} from '@lab/core';
import type { Point, Renderer, Ticker } from 'pixi.js';
import {
  CELLS,
  winningCells,
  type CardOutcome,
  type CardRequest,
  type CardStats,
} from './logic/card';
import { CARD_HEIGHT, CARD_WIDTH, coinIcon, ScratchCard } from './view/card';

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
const FOIL_FLAKES = [0xb9bec9, 0xd5d9e0, 0x8c929c];

export interface ScratchSceneOptions {
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
  private readonly odds: OddsTable;
  private readonly confetti = new Confetti();
  private result: RoundResult<CardOutcome> | null = null;
  private lastScratchSound = 0;

  constructor({ renderer, stats, wallet, sounds, server }: ScratchSceneOptions) {
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
    });
    this.hud.onAction = () => this.onAction();
    this.card = new ScratchCard(renderer);
    this.card.onScratch = (added, at) => this.onScratch(added, at);
    this.odds = new OddsTable({
      title: 'MATCH 3 PRIZES',
      rows: stats.odds.map(({ prize, chance }) => ({
        icon: coinIcon(prize),
        name: `×${prize}`,
        value: `${(chance * 100).toFixed(2)}%`,
      })),
      footer: `RTP ${(stats.rtp * 100).toFixed(1)}% · WIN 1 IN ${(1 / stats.hitRate).toFixed(1)}`,
    });

    this.addChild(this.odds, this.card, this.hud, this.confetti);
    this.round.onChange((state) => {
      this.hud.action.text = ACTION_LABELS[state];
      this.hud.action.enabled = state !== 'buying' && state !== 'revealing';
      this.hud.setBetting(state === 'idle');
    });
    this.hud.say('Buy a card, then scratch it');
  }

  override update(ticker: Ticker): void {
    this.confetti.tick(ticker.deltaMS / 1000);
  }

  override resize({ width, height, orientation }: Viewport): void {
    const { hud } = this;
    if (orientation === 'landscape') {
      const table = this.odds.arrange(1);
      const column = 960;
      this.card.position.set(70, (height - CARD_HEIGHT) / 2 - 12);
      hud.placeHeader(column, 70);
      this.odds.position.set(column - table.width / 2, 150);
      hud.placeControls(column, 150 + table.height + 90);
      hud.panel.position.set(column - hud.panelWidth / 2, height - 92);
      hud.mute.position.set(width - 48, 44);
    } else {
      const table = this.odds.arrange(2);
      const cx = width / 2;
      hud.placeHeader(cx, 70);
      this.card.position.set(cx - CARD_WIDTH / 2, 150);
      const controlsY = this.card.y + CARD_HEIGHT + 90;
      hud.placeControls(cx, controlsY, { spread: 170 });
      this.odds.position.set(cx - table.width / 2, controlsY + 112);
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
    this.confetti.burst({
      x: this.card.x + at.x,
      y: this.card.y + at.y,
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
      this.confetti.burst({
        x: this.card.x + CARD_WIDTH / 2,
        y: this.card.y + CARD_HEIGHT * 0.45,
        count: Math.round(70 + 40 * Math.log2(outcome.prize + 1)),
      });
      await this.hud.presentWin(win, outcome.prize);
    }
    this.hud.endRound();
    this.round.send('done');
  }
}

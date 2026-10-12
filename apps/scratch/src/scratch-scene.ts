import {
  BalancePanel,
  Button,
  colors,
  Confetti,
  countUpSeconds,
  formatCredits,
  Label,
  MuteButton,
  OddsTable,
  onKey,
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

const BUTTON_LABELS: Record<State, string> = {
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
const PANEL_WIDTH = 520;
const FOIL_FLAKES = [0xb9bec9, 0xd5d9e0, 0x8c929c];

export interface ScratchSceneOptions {
  renderer: Renderer;
  stats: CardStats;
  wallet: Wallet;
  sounds: SoundManager;
  server: OutcomeService<CardRequest, CardOutcome>;
}

export class ScratchScene extends Scene {
  private readonly wallet: Wallet;
  private readonly sounds: SoundManager;
  private readonly server: OutcomeService<CardRequest, CardOutcome>;

  private readonly round = new StateMachine<State, Event>('idle', {
    idle: { buy: 'buying' },
    buying: { dealt: 'scratching', failed: 'idle' },
    scratching: { finish: 'revealing' },
    revealing: { revealed: 'presenting' },
    presenting: { done: 'idle' },
  });

  private readonly title = new Label('SCRATCH CARD', 'title', {
    dropShadow: { color: colors.neon, blur: 12, distance: 0, alpha: 0.9 },
  });
  private readonly message = new Label('', 'body', { fill: colors.muted });
  private readonly card: ScratchCard;
  private readonly odds: OddsTable;
  private readonly panel: BalancePanel;
  private readonly mute: MuteButton;
  private readonly confetti = new Confetti();
  private readonly mainButton = new Button({
    label: BUTTON_LABELS.idle,
    shortcut: 'Space',
    width: 140,
    height: 140,
    fontSize: 30,
  });
  private readonly betDown = new Button({
    label: '−',
    title: 'Cheaper card',
    shortcut: 'Arrow Down',
    width: 64,
    height: 64,
    fontSize: 34,
    color: colors.cyan,
  });
  private readonly betUp = new Button({
    label: '+',
    title: 'Pricier card',
    shortcut: 'Arrow Up',
    width: 64,
    height: 64,
    fontSize: 34,
    color: colors.cyan,
  });
  private readonly betCaption = new Label('CARD PRICE', 'caption');
  private keyBindings: (() => void)[] = [];
  private result: RoundResult<CardOutcome> | null = null;
  private lastScratchSound = 0;

  constructor({ renderer, stats, wallet, sounds, server }: ScratchSceneOptions) {
    super();
    this.wallet = wallet;
    this.sounds = sounds;
    this.server = server;

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
    this.panel = new BalancePanel(wallet, PANEL_WIDTH);
    this.mute = new MuteButton(sounds);

    this.title.anchor.set(0.5);
    this.message.anchor.set(0.5);
    this.betCaption.anchor.set(0.5);

    this.mainButton.onPress = () => this.onMainPressed();
    this.betDown.onPress = () => this.changeBet(-1);
    this.betUp.onPress = () => this.changeBet(1);

    this.addChild(
      this.title,
      this.message,
      this.odds,
      this.card,
      this.mainButton,
      this.betDown,
      this.betUp,
      this.betCaption,
      this.panel,
      this.mute,
      this.confetti,
    );
    this.round.onChange(() => this.syncControls());
    this.say('Buy a card, then scratch it');
  }

  override update(ticker: Ticker): void {
    this.confetti.tick(ticker.deltaMS / 1000);
  }

  override resize({ width, height, orientation }: Viewport): void {
    if (orientation === 'landscape') {
      const table = this.odds.arrange(1);
      this.card.position.set(70, (height - CARD_HEIGHT) / 2 - 12);
      const column = 960;
      this.title.position.set(column, 70);
      this.message.position.set(column, 114);
      this.odds.position.set(column - table.width / 2, 150);
      const controlsY = 150 + table.height + 90;
      this.mainButton.position.set(column, controlsY);
      this.betDown.position.set(column - 135, controlsY);
      this.betUp.position.set(column + 135, controlsY);
      this.betCaption.position.set(column, controlsY + 86);
      this.panel.position.set(column - PANEL_WIDTH / 2, height - 92);
      this.mute.position.set(width - 48, 44);
    } else {
      const table = this.odds.arrange(2);
      const cx = width / 2;
      this.title.position.set(cx, 70);
      this.message.position.set(cx, 116);
      this.card.position.set(cx - CARD_WIDTH / 2, 150);
      const controlsY = this.card.y + CARD_HEIGHT + 90;
      this.mainButton.position.set(cx, controlsY);
      this.betDown.position.set(cx - 170, controlsY);
      this.betUp.position.set(cx + 170, controlsY);
      this.betCaption.position.set(cx, controlsY + 86);
      this.odds.position.set(cx - table.width / 2, controlsY + 112);
      this.panel.position.set(cx - PANEL_WIDTH / 2, height - 100);
      this.mute.position.set(width - 50, 60);
    }
  }

  // Keys are live only while this is the current scene; destroy() covers teardown without exit.
  override enter(): void {
    this.unbindKeys();
    this.keyBindings = [
      onKey('Space', () => this.onMainPressed()),
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

  private onMainPressed() {
    switch (this.round.state) {
      case 'idle':
        void this.buy();
        break;
      case 'scratching':
        void this.finish();
        break;
      case 'presenting':
        this.panel.skipCountUp();
        break;
      default:
        break;
    }
  }

  private changeBet(direction: 1 | -1) {
    if (this.round.state !== 'idle') return;
    this.wallet.stepBet(direction);
    this.sounds.play('click');
  }

  private async buy() {
    const bet = this.wallet.bet;
    if (!this.wallet.debit(bet)) {
      if (this.wallet.topUp())
        this.say(`Free top-up: ${formatCredits(this.wallet.balance)} credits`);
      else this.say('Not enough credits — pick a cheaper card');
      return;
    }

    this.round.send('buy');
    this.sounds.play('buy');
    this.panel.clearWin();
    this.panel.hold();
    this.confetti.reset();

    // Only the server call is guarded: a local error after the card was settled must not be
    // mistaken for a failed purchase (and refund a card that was already played).
    this.result = await this.server.play({ bet }).catch(() => null);
    if (!this.result) {
      this.wallet.credit(bet);
      this.panel.release();
      this.round.send('failed');
      this.say('Connection problem — your card was refunded');
      return;
    }

    // The card is settled the moment it's sold; the balance panel shows the win after the reveal.
    this.wallet.credit(this.result.win);
    this.card.deal(this.result.outcome.cells);
    this.card.enabled = true;
    this.round.send('dealt');
    this.say('Scratch away — or press REVEAL');
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
      this.say('No match this time — try another card');
    } else {
      this.card.highlight(winningCells(outcome.cells));
      this.sounds.play('win');
      this.say(`THREE ×${outcome.prize} — WIN ${formatCredits(win)}!`, colors.gold);
      this.confetti.burst({
        x: this.card.x + CARD_WIDTH / 2,
        y: this.card.y + CARD_HEIGHT * 0.45,
        count: Math.round(70 + 40 * Math.log2(outcome.prize + 1)),
      });
      await this.panel.showWin(win, countUpSeconds(outcome.prize));
    }
    this.panel.release();
    this.round.send('done');
  }

  private syncControls() {
    const idle = this.round.state === 'idle';
    this.mainButton.text = BUTTON_LABELS[this.round.state];
    this.mainButton.enabled = this.round.state !== 'buying' && this.round.state !== 'revealing';
    this.betDown.enabled = idle;
    this.betUp.enabled = idle;
  }

  private say(text: string, color: number = colors.muted) {
    this.message.text = text;
    this.message.style.fill = color;
  }
}

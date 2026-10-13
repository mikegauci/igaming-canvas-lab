import {
  colors,
  formatCredits,
  GameHud,
  Label,
  onKey,
  Scene,
  StateMachine,
  type OutcomeService,
  type SoundManager,
  type Viewport,
  type Wallet,
} from '@lab/core';
import { gsap } from 'gsap';
import type { Texture, Ticker } from 'pixi.js';
import { CHESTS, type BonusOutcome, type BonusRequest, type BonusStats } from './logic/prizes';
import { planCountUp, tierFor, type TierName } from './logic/tiers';
import { BigWinOverlay } from './view/big-win';
import { BonusCabinet } from './view/cabinet';
import { Chest, CHEST_WIDTH, prizeLabel } from './view/chest';
import { Mascot } from './view/mascot';

type State = 'idle' | 'opening' | 'presenting' | 'resetting';
type Event = 'pick' | 'failed' | 'opened' | 'presented' | 'ready';

const ACTION_LABELS: Record<State, string> = {
  idle: 'PICK',
  opening: '…',
  presenting: 'SKIP',
  resetting: '…',
};

/** The chest wobbles at least this long, even if the server answers instantly. */
const MIN_SUSPENSE_SECONDS = 0.9;

export interface BonusSceneOptions {
  artwork: Texture;
  coinTexture: Texture;
  stats: BonusStats;
  wallet: Wallet;
  sounds: SoundManager;
  /** The game, for the stats-panel toggle. */
  perf?: { debug: boolean };
  server: OutcomeService<BonusRequest, BonusOutcome>;
  /** Shown under the chests in showcase mode (?demo=…). */
  notice?: string;
}

export class BonusScene extends Scene {
  private readonly sounds: SoundManager;
  private readonly server: OutcomeService<BonusRequest, BonusOutcome>;
  private readonly round = new StateMachine<State, Event>('idle', {
    idle: { pick: 'opening' },
    opening: { failed: 'idle', opened: 'presenting' },
    presenting: { presented: 'resetting' },
    resetting: { ready: 'idle' },
  });
  private readonly hud: GameHud;
  private readonly mascot = new Mascot();
  private readonly chests: Chest[];
  private readonly info: Label;
  private readonly overlay: BigWinOverlay;
  private readonly cabinet: BonusCabinet;
  private keyBindings: (() => void)[] = [];

  constructor({
    artwork,
    coinTexture,
    stats,
    wallet,
    sounds,
    server,
    notice,
    perf,
  }: BonusSceneOptions) {
    super();
    this.sounds = sounds;
    this.server = server;

    this.hud = new GameHud({
      stats: perf,
      title: 'BONUS ROUND',
      wallet,
      sounds,
      actionLabel: ACTION_LABELS.idle,
      actionSize: 124,
      betCaption: 'STAKE',
      betTitles: ['Lower stake', 'Raise stake'],
      panelWidth: 560,
      appearance: 'arcade',
    });
    this.hud.onAction = () => this.onAction();
    this.chests = Array.from({ length: CHESTS }, (_, i) => {
      const chest = new Chest(i);
      chest.onPick = () => void this.pick(i);
      return chest;
    });
    this.info = new Label(
      notice ??
        `RTP ${(stats.rtp * 100).toFixed(0)}% · PAYS ON ${(stats.hitRate * 100).toFixed(0)}% · ` +
          `BIG WIN 1 IN ${Math.round(1 / stats.bigWinRate)}`,
      'caption',
      { fontSize: 11, letterSpacing: 0.8, fill: notice ? colors.neon : 0xc2bdd9 },
    );
    this.info.anchor.set(0.5);
    this.overlay = new BigWinOverlay(coinTexture);
    this.overlay.onTier = (tier) => this.onTier(tier);

    this.cabinet = new BonusCabinet(artwork);
    this.hud.message.style.fontSize = 16;
    this.hud.message.style.wordWrap = true;
    this.hud.message.style.align = 'center';
    this.hud.betCaption.style.fontSize = 11;

    this.addChild(this.cabinet, this.mascot, ...this.chests, this.info, this.hud, this.overlay);
    this.round.onChange((state) => {
      this.hud.action.text = ACTION_LABELS[state];
      this.hud.action.enabled = state === 'idle' || state === 'presenting';
      this.hud.setBetting(state === 'idle');
      this.chests.forEach((chest) => (chest.enabled = state === 'idle'));
    });
    this.hud.say('Pick a chest — 1, 2 or 3');
  }

  override idle(): boolean {
    return this.round.state === 'idle';
  }

  override update(ticker: Ticker): void {
    this.overlay.update(ticker.deltaMS / 1000);
    this.cabinet.update(ticker.deltaMS / 1000);
  }

  override resize(viewport: Viewport): void {
    const { width, height, orientation, screen } = viewport;
    const { hud } = this;
    this.overlay.resize(width, height, screen);
    hud.message.style.wordWrapWidth = orientation === 'landscape' ? 232 : 560;
    hud.betCaption.visible = orientation === 'landscape';
    if (orientation === 'landscape') {
      // Centred like the other games: the mascot on the left, the chests, then the controls.
      const cx = width / 2;
      const stage = { x: cx - 284, y: 172, width: 568, height: 410 };
      const column = 1060;
      hud.placeHeader(cx, 95);
      hud.message.position.set(column, 217);
      this.mascot.position.set(220, 562);
      this.mascot.scale.set(0.85);
      this.chests.forEach((chest, i) => {
        chest.scale.set(0.86);
        chest.position.set(cx + (i - 1) * 168, 470);
      });
      this.info.position.set(cx, 540);
      hud.placeControls(column, 339, { stacked: true });
      hud.panel.position.set(cx - hud.panelWidth / 2, height - 84);
      hud.placeToggles(width - 54, 44);
      this.cabinet.arrange(viewport, 157, stage, 426, { x: 944, y: 242, width: 232, height: 342 });
    } else {
      const cx = width / 2;
      const stage = { x: 30, y: 250, width: 660, height: 620 };
      hud.placeHeader(cx, 143);
      hud.message.position.set(cx, 212);
      this.mascot.position.set(cx, 572);
      this.mascot.scale.set(0.9);
      const gap = CHEST_WIDTH + 45;
      this.chests.forEach((chest, i) => {
        chest.scale.set(1);
        chest.position.set(cx + (i - 1) * gap, 790);
      });
      this.info.position.set(cx, 846);
      hud.placeControls(cx, 980, { spread: 207 });
      hud.panel.position.set(cx - hud.panelWidth / 2, 1105);
      hud.placeToggles(width - 57, 51);
      this.cabinet.arrange(viewport, 892, stage, 535, { x: 65, y: 910, width: 590, height: 178 });
    }
  }

  override enter(): void {
    this.hud.bindKeys();
    this.keyBindings.forEach((unbind) => unbind());
    this.keyBindings = ['Digit1', 'Digit2', 'Digit3'].map((code, i) =>
      onKey(code, () => void this.pick(i)),
    );
  }

  override exit(): void {
    this.hud.unbindKeys();
    this.keyBindings.forEach((unbind) => unbind());
    this.keyBindings = [];
  }

  override destroy(...args: Parameters<Scene['destroy']>): void {
    this.exit();
    gsap.killTweensOf(this);
    super.destroy(...args);
  }

  private onAction() {
    if (this.round.state === 'idle') void this.pick(Math.floor(Math.random() * CHESTS));
    else if (this.round.state === 'presenting') {
      if (this.overlay.playing) this.overlay.skip();
      else this.hud.skipCountUp();
    }
  }

  private async pick(index: number) {
    if (this.round.state !== 'idle') return;
    const chest = this.chests[index]!;
    const suspense = gsap.delayedCall(MIN_SUSPENSE_SECONDS, () => undefined);

    const start = await this.hud.startRound(this.server, () => {
      this.round.send('pick');
      this.sounds.play('pick');
      this.hud.say('Opening…');
      this.mascot.play('anticipate');
      chest.shake();
    });
    if (start.status === 'unaffordable') return;
    if (start.status === 'failed') {
      await chest.close();
      this.mascot.play('idle');
      this.hud.endRound();
      this.round.send('failed');
      return;
    }

    await suspense.then(() => undefined);
    const { outcome, win, bet } = start.result;
    this.sounds.play('open');
    await chest.open(outcome.multiplier);
    this.round.send('opened');
    this.hud.unlock('bonus-open');

    const tier = tierFor(win, bet);
    this.mascot.play('idle');
    if (win === 0) {
      this.mascot.play('sad');
      this.sounds.play('empty');
      this.hud.say('Empty! Better luck next chest');
    } else if (tier) {
      this.mascot.play('cheer');
      this.hud.say(`${tier} WIN — ${formatCredits(win)}!`, colors.gold);
      await this.overlay.play(planCountUp(win, bet));
      // The overlay did the counting; the panel just shows the result.
      await this.hud.panel.showWin(win, 0);
    } else if (outcome.multiplier < 1) {
      // Some stake back is still a loss: no cheering.
      this.sounds.play('empty');
      this.hud.say(`${prizeLabel(outcome.multiplier)} — ${formatCredits(win)} back`);
      await this.hud.presentWin(win, outcome.multiplier);
    } else {
      this.mascot.play('cheer');
      this.sounds.play('win');
      this.hud.say(`${prizeLabel(outcome.multiplier)} — WIN ${formatCredits(win)}!`, colors.gold);
      await this.hud.presentWin(win, outcome.multiplier);
    }
    this.hud.endRound();

    // Show what the other chests held: the server decided those too.
    const others = this.chests.filter((_, i) => i !== index);
    await Promise.all(
      others.map((other, i) =>
        gsap
          .delayedCall(i * 0.2, () => undefined)
          .then(() => other.open(outcome.others[i]!, { featured: false, dimmed: true })),
      ),
    );
    this.round.send('presented');

    await gsap.delayedCall(1.4, () => undefined);
    await Promise.all(this.chests.map((c) => c.close()));
    this.mascot.play('idle');
    this.round.send('ready');
    this.hud.say('Pick a chest — 1, 2 or 3');
  }

  private onTier(tier: TierName) {
    this.sounds.play(tier === 'BIG' ? 'tier' : 'tierUp');
    this.sounds.play('coins');
    // Screen shake: the whole scene jolts, harder at higher tiers.
    const strength = tier === 'EPIC' ? 16 : tier === 'MEGA' ? 11 : 7;
    gsap
      .timeline()
      .to(this, { x: strength, y: -strength / 2, duration: 0.04 })
      .to(this, { x: -strength, y: strength / 2, duration: 0.05 })
      .to(this, { x: strength / 2, y: 0, duration: 0.05 })
      .to(this, { x: 0, y: 0, duration: 0.08 });
  }
}

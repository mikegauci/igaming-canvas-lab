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
  coinTexture: Texture;
  stats: BonusStats;
  wallet: Wallet;
  sounds: SoundManager;
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
  private keyBindings: (() => void)[] = [];

  constructor({ coinTexture, stats, wallet, sounds, server, notice }: BonusSceneOptions) {
    super();
    this.sounds = sounds;
    this.server = server;

    this.hud = new GameHud({
      title: 'BONUS ROUND',
      wallet,
      sounds,
      actionLabel: ACTION_LABELS.idle,
      actionSize: 130,
      betCaption: 'STAKE',
      betTitles: ['Lower stake', 'Raise stake'],
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
      notice ? { fill: colors.neon } : {},
    );
    this.info.anchor.set(0.5);
    this.overlay = new BigWinOverlay(coinTexture);
    this.overlay.onTier = (tier) => this.onTier(tier);

    this.addChild(this.mascot, ...this.chests, this.info, this.hud, this.overlay);
    this.round.onChange((state) => {
      this.hud.action.text = ACTION_LABELS[state];
      this.hud.action.enabled = state === 'idle' || state === 'presenting';
      this.hud.setBetting(state === 'idle');
      this.chests.forEach((chest) => (chest.enabled = state === 'idle'));
    });
    this.hud.say('Pick a chest — 1, 2 or 3');
  }

  override update(ticker: Ticker): void {
    this.overlay.update(ticker.deltaMS / 1000);
  }

  override resize({ width, height, orientation }: Viewport): void {
    const { hud } = this;
    this.overlay.resize(width, height);
    if (orientation === 'landscape') {
      hud.placeHeader(640, 60);
      this.mascot.position.set(190, 560);
      this.mascot.scale.set(1);
      this.chests.forEach((chest, i) => chest.position.set(470 + i * 215, 470));
      this.info.position.set(685, 520);
      hud.placeControls(1130, 300, { stacked: true });
      hud.panel.position.set(640 - hud.panelWidth / 2, height - 92);
      hud.mute.position.set(width - 48, 44);
    } else {
      const cx = width / 2;
      hud.placeHeader(cx, 70);
      this.mascot.position.set(cx, 460);
      this.mascot.scale.set(0.9);
      const gap = CHEST_WIDTH + 50;
      this.chests.forEach((chest, i) => chest.position.set(cx + (i - 1) * gap, 760));
      this.info.position.set(cx, 810);
      hud.placeControls(cx, 940, { spread: 180 });
      hud.panel.position.set(cx - hud.panelWidth / 2, height - 100);
      hud.mute.position.set(width - 50, 60);
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

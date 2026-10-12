import { colors } from '@lab/core';
import { gsap } from 'gsap';
import { Container, Graphics } from 'pixi.js';

export type MascotAnimation = 'idle' | 'anticipate' | 'cheer' | 'celebrate' | 'sad';

/**
 * What the scene needs from a character: named animations, like a Spine skeleton's
 * `state.setAnimation(0, name, loop)`. A spine-pixi-v8 `Spine` could implement this interface and
 * replace the hand-rigged mascot below without touching the game.
 */
export interface CharacterRig extends Container {
  play(animation: MascotAnimation): void;
}

type Expression = 'smile' | 'grin' | 'o' | 'frown';

const GOLD = colors.gold;
const GOLD_DARK = 0xb8901a;
const INK = 0x2b1a0a;

/** A bone: a container that rotates around its joint, carrying the parts attached to it. */
function bone(x: number, y: number, ...parts: Container[]): Container {
  const joint = new Container({ children: parts });
  joint.position.set(x, y);
  return joint;
}

function limb(length: number, width: number, end: Graphics): Container {
  const segment = new Graphics().roundRect(-width / 2, 0, width, length, width / 2).fill(GOLD_DARK);
  return new Container({ children: [segment, end] });
}

/**
 * "Lucky", a coin mascot rigged by hand: a skeleton of containers (rig → body → face, arms and
 * legs as bones on their joints) animated with GSAP timelines. The same structure Spine uses
 * (bones, attachments, named animations), just authored in code.
 */
export class Mascot extends Container implements CharacterRig {
  private readonly rig = new Container();
  private readonly body = new Container();
  private readonly eyes = new Container();
  private readonly mouth = new Graphics();
  private readonly leftArm: Container;
  private readonly rightArm: Container;
  private current: gsap.core.Timeline | null = null;
  private blinkCall: gsap.core.Tween | null = null;
  private animation: MascotAnimation = 'idle';

  constructor() {
    super();
    const shadow = new Graphics().ellipse(0, 0, 70, 14).fill({ color: 0x000000, alpha: 0.35 });

    const shoe = (x: number) => new Graphics().ellipse(x, 42, 17, 9).fill(colors.neon);
    const leftLeg = bone(-28, -50, limb(40, 18, shoe(-4)));
    const rightLeg = bone(28, -50, limb(40, 18, shoe(4)));

    const glove = new Graphics()
      .circle(0, 60, 14)
      .fill(colors.text)
      .stroke({ color: INK, width: 2 });
    const glove2 = new Graphics()
      .circle(0, 60, 14)
      .fill(colors.text)
      .stroke({ color: INK, width: 2 });
    this.leftArm = bone(-70, -150, limb(56, 16, glove));
    this.rightArm = bone(70, -150, limb(56, 16, glove2));

    const coin = new Graphics()
      .circle(0, 0, 78)
      .fill(GOLD)
      .stroke({ color: GOLD_DARK, width: 8 })
      .circle(0, 0, 62)
      .stroke({ color: GOLD_DARK, width: 3, alpha: 0.5 })
      .ellipse(-32, -38, 18, 10)
      .fill({ color: 0xffffff, alpha: 0.5 })
      .circle(-44, 16, 9)
      .fill({ color: colors.neon, alpha: 0.35 })
      .circle(44, 16, 9)
      .fill({ color: colors.neon, alpha: 0.35 });
    for (const x of [-24, 24]) {
      const eye = new Graphics()
        .ellipse(0, 0, 13, 16)
        .fill(0xffffff)
        .circle(2, 3, 7)
        .fill(INK)
        .circle(4, 0, 2.5)
        .fill(0xffffff);
      eye.position.set(x, 0);
      this.eyes.addChild(eye);
    }
    this.eyes.position.set(0, -12);
    this.mouth.position.set(0, 22);
    this.body.addChild(coin, this.eyes, this.mouth);
    this.body.position.set(0, -125);

    this.rig.addChild(leftLeg, rightLeg, this.leftArm, this.rightArm, this.body);
    this.addChild(shadow, this.rig);
    this.express('smile');
    this.play('idle');
    this.scheduleBlink();
  }

  play(animation: MascotAnimation): void {
    this.animation = animation;
    this.current?.kill();
    gsap.killTweensOf([this.rig, this.body, this.body.scale, this.leftArm, this.rightArm]);
    // Every animation starts from the rest pose.
    const pose = gsap.timeline();
    pose.to(this.rig, { x: 0, y: 0, rotation: 0, duration: 0.15 }, 0);
    pose.to(this.body, { y: -125, rotation: 0, duration: 0.15 }, 0);
    pose.to(this.body.scale, { x: 1, y: 1, duration: 0.15 }, 0);
    pose.to(this.eyes.scale, { y: 1, duration: 0.15 }, 0);
    pose.to([this.leftArm, this.rightArm], { rotation: 0, duration: 0.15 }, 0);

    const tl = gsap.timeline();
    this.current = tl;
    switch (animation) {
      case 'idle':
        this.express('smile');
        tl.add(pose)
          .to(this.body, { y: -131, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 })
          .to(
            this.leftArm,
            { rotation: 0.14, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 },
            '<',
          )
          .to(
            this.rightArm,
            { rotation: -0.14, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 },
            '<',
          );
        break;
      case 'anticipate':
        this.express('o');
        tl.add(pose)
          .to(this.rig, {
            rotation: 0.05,
            duration: 0.18,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          })
          .to(
            this.leftArm,
            { rotation: -0.55, duration: 0.12, ease: 'sine.inOut', yoyo: true, repeat: -1 },
            '<',
          )
          .to(
            this.rightArm,
            { rotation: 0.55, duration: 0.12, ease: 'sine.inOut', yoyo: true, repeat: -1 },
            '<',
          )
          .to(this.body, { y: -128, duration: 0.18, yoyo: true, repeat: -1 }, '<');
        break;
      case 'cheer':
        this.express('grin');
        tl.add(pose)
          .to(this.body.scale, { x: 1.1, y: 0.86, duration: 0.12, ease: 'power2.out' })
          .to(this.body.scale, { x: 0.95, y: 1.08, duration: 0.18 })
          .to(this.rig, { y: -80, duration: 0.32, ease: 'power2.out' }, '<')
          .to(this.leftArm, { rotation: 2.6, duration: 0.25, ease: 'back.out(2)' }, '<')
          .to(this.rightArm, { rotation: -2.6, duration: 0.25, ease: 'back.out(2)' }, '<')
          .to(this.rig, { y: 0, duration: 0.4, ease: 'bounce.out' })
          .to(this.body.scale, { x: 1, y: 1, duration: 0.2 }, '<')
          .call(() => this.play('celebrate'));
        break;
      case 'celebrate':
        this.express('grin');
        tl.add(pose)
          .set(this.leftArm, { rotation: 2.4 })
          .set(this.rightArm, { rotation: -1.7 })
          .to(this.rig, { y: -26, duration: 0.22, ease: 'power1.out', yoyo: true, repeat: -1 })
          .to(this.leftArm, { rotation: 1.7, duration: 0.22, yoyo: true, repeat: -1 }, '<')
          .to(this.rightArm, { rotation: -2.4, duration: 0.22, yoyo: true, repeat: -1 }, '<')
          .to(
            this.body,
            { rotation: 0.08, duration: 0.44, ease: 'sine.inOut', yoyo: true, repeat: -1 },
            '<',
          );
        break;
      case 'sad':
        this.express('frown');
        tl.add(pose)
          .to(this.body, { y: -112, rotation: -0.08, duration: 0.5, ease: 'power2.out' })
          .to(this.body.scale, { y: 0.94, duration: 0.5 }, '<')
          .to(this.eyes.scale, { y: 0.5, duration: 0.3 }, '<')
          .to([this.leftArm, this.rightArm], { rotation: 0, duration: 0.4 }, '<');
        break;
    }
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    this.current?.kill();
    this.blinkCall?.kill();
    gsap.killTweensOf([
      this.rig,
      this.body,
      this.body.scale,
      this.eyes.scale,
      this.leftArm,
      this.rightArm,
    ]);
    super.destroy(...args);
  }

  /** Blinks every few seconds, independent of the body animation (except when sad). */
  private scheduleBlink() {
    this.blinkCall = gsap.delayedCall(2 + Math.random() * 2.5, () => {
      if (this.animation !== 'sad') {
        gsap.to(this.eyes.scale, { y: 0.1, duration: 0.07, yoyo: true, repeat: 1 });
      }
      this.scheduleBlink();
    });
  }

  private express(expression: Expression) {
    const g = this.mouth.clear();
    switch (expression) {
      case 'smile':
        g.moveTo(-20, 0)
          .quadraticCurveTo(0, 18, 20, 0)
          .stroke({ color: INK, width: 5, cap: 'round' });
        break;
      case 'grin':
        g.moveTo(-26, -4)
          .quadraticCurveTo(0, 38, 26, -4)
          .closePath()
          .fill(0x5a1a1a)
          .circle(0, 14, 8)
          .fill(colors.neon);
        break;
      case 'o':
        g.ellipse(0, 6, 9, 12).fill(0x5a1a1a);
        break;
      case 'frown':
        g.moveTo(-18, 12)
          .quadraticCurveTo(0, -4, 18, 12)
          .stroke({ color: INK, width: 5, cap: 'round' });
        break;
    }
  }
}

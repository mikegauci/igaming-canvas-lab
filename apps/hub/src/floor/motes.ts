import { colors } from '@lab/core';
import { Particle, ParticleContainer, type Texture } from 'pixi.js';

/** The most motes on screen, on the high tier; lower tiers show a share of them. */
const MAX_MOTES = 110;
const TINTS = [colors.neon, colors.cyan, colors.gold, 0xffffff];

interface Mote {
  particle: Particle;
  speed: number;
  sway: number;
  phase: number;
  twinkle: number;
  alpha: number;
}

/**
 * Glowing motes drifting up through the scene, added on top of whatever is behind them. One
 * ParticleContainer (a single draw call for all of them) whose position and alpha are uploaded
 * per frame; everything else stays static.
 */
export class Motes extends ParticleContainer {
  private readonly motes: Mote[] = [];
  private areaWidth = 1280;
  private areaHeight = 720;
  private active = MAX_MOTES;
  private time = 0;

  constructor(texture: Texture) {
    super({ dynamicProperties: { position: true, color: true }, roundPixels: false });
    this.blendMode = 'add';
    for (let i = 0; i < MAX_MOTES; i++) {
      const scale = 0.25 + Math.random() * 0.75;
      const particle = new Particle({
        texture,
        anchorX: 0.5,
        anchorY: 0.5,
        scaleX: scale,
        scaleY: scale,
        tint: TINTS[i % TINTS.length]!,
      });
      this.motes.push({
        particle,
        // Bigger motes are nearer, so they move faster.
        speed: 8 + scale * 26,
        sway: 6 + Math.random() * 16,
        phase: Math.random() * Math.PI * 2,
        twinkle: 0.8 + Math.random() * 2.2,
        alpha: 0.25 + scale * 0.6,
      });
      this.addParticle(particle);
    }
  }

  /** Spreads the motes over the visible area (design units). */
  layout(width: number, height: number): void {
    this.areaWidth = width;
    this.areaHeight = height;
    for (const mote of this.motes) {
      mote.particle.x = Math.random() * width;
      mote.particle.y = Math.random() * height;
    }
  }

  /** Shows `share` (0–1) of the motes, for the quality tier. */
  setDensity(share: number): void {
    this.active = Math.round(MAX_MOTES * share);
  }

  /** Named tick, not update: ParticleContainer.update() re-uploads static properties. */
  tick(seconds: number): void {
    this.time += seconds;
    this.motes.forEach((mote, i) => {
      const { particle } = mote;
      if (i >= this.active) {
        particle.alpha = 0;
        return;
      }
      particle.y -= mote.speed * seconds;
      particle.x += Math.sin(this.time * 0.7 + mote.phase) * mote.sway * seconds;
      if (particle.y < -20) {
        particle.y = this.areaHeight + 20;
        particle.x = Math.random() * this.areaWidth;
      }
      particle.alpha = mote.alpha * (0.55 + 0.45 * Math.sin(this.time * mote.twinkle + mote.phase));
    });
  }
}

import { Particle, ParticleContainer, Texture } from 'pixi.js';
import { colors } from '../theme';

export interface BurstOptions {
  x: number;
  y: number;
  count: number;
  /** Direction of travel in radians (0 = right, -π/2 = up). */
  angle?: number;
  /** Total cone width in radians. */
  spread?: number;
  /** Launch speed range in px/s. */
  speed?: readonly [number, number];
  /** Piece size in px (width; height is 60%). */
  size?: number;
  gravity?: number;
  /** Seconds each piece lives. */
  life?: number;
  palette?: readonly number[];
}

interface Piece {
  particle: Particle;
  vx: number;
  vy: number;
  spin: number;
  flutter: number;
  gravity: number;
  width: number;
  height: number;
  life: number;
  age: number;
}

const DEFAULT_PALETTE = [colors.neon, colors.cyan, colors.gold, 0x7cff6b, 0xffffff];
const FADE_SECONDS = 0.4;

/**
 * Confetti and debris on a ParticleContainer: every piece is one quad of the same white
 * texture, tinted, so a burst of hundreds still renders in one draw call. Pieces are allocated
 * once and recycled (an object pool), so bursts don't create garbage mid-game.
 */
export class Confetti extends ParticleContainer {
  private readonly pieces: Piece[] = [];
  private readonly free: Piece[] = [];
  private readonly live = new Set<Piece>();

  constructor(capacity = 400) {
    super({ dynamicProperties: { position: true, rotation: true, color: true, vertex: true } });
    for (let i = 0; i < capacity; i++) {
      const particle = new Particle({ texture: Texture.WHITE, anchorX: 0.5, anchorY: 0.5 });
      particle.alpha = 0;
      this.addParticle(particle);
      const piece: Piece = {
        particle,
        vx: 0,
        vy: 0,
        spin: 0,
        flutter: 0,
        gravity: 0,
        width: 0,
        height: 0,
        life: 0,
        age: 0,
      };
      this.pieces.push(piece);
      this.free.push(piece);
    }
    this.renderable = false;
  }

  /** Pieces currently flying. */
  get active(): number {
    return this.live.size;
  }

  burst({
    x,
    y,
    count,
    angle = -Math.PI / 2,
    spread = Math.PI / 2.2,
    speed = [450, 1050],
    size = 12,
    gravity = 1300,
    life = 2.2,
    palette = DEFAULT_PALETTE,
  }: BurstOptions): void {
    const { width: textureWidth, height: textureHeight } = Texture.WHITE;
    for (let i = 0; i < count; i++) {
      // Reuse the oldest live piece when the pool is empty rather than allocating.
      let piece = this.free.pop();
      if (!piece) {
        piece = this.live.values().next().value;
        if (!piece) return;
        this.live.delete(piece);
      }
      const direction = angle + (Math.random() - 0.5) * spread;
      const velocity = speed[0] + Math.random() * (speed[1] - speed[0]);
      Object.assign(piece, {
        vx: Math.cos(direction) * velocity,
        vy: Math.sin(direction) * velocity,
        spin: (Math.random() - 0.5) * 14,
        flutter: Math.random() * Math.PI * 2,
        gravity,
        width: (size * (0.7 + Math.random() * 0.6)) / textureWidth,
        height: (size * 0.6 * (0.7 + Math.random() * 0.6)) / textureHeight,
        life: life * (0.75 + Math.random() * 0.5),
        age: 0,
      });
      const { particle } = piece;
      particle.x = x;
      particle.y = y;
      particle.rotation = Math.random() * Math.PI;
      particle.tint = palette[Math.floor(Math.random() * palette.length)]!;
      particle.alpha = 1;
      this.live.add(piece);
    }
    this.renderable = this.live.size > 0;
  }

  /** Advances the simulation. (ParticleContainer already has an update() for its buffers.) */
  tick(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 0.05);
    const drag = Math.pow(0.35, dt); // air resistance: keeps ~35% of speed per second
    for (const piece of this.live) {
      const { particle } = piece;
      piece.age += dt;
      if (piece.age >= piece.life) {
        particle.alpha = 0;
        this.live.delete(piece);
        this.free.push(piece);
        continue;
      }
      piece.vy += piece.gravity * dt;
      piece.vx *= drag;
      piece.vy *= drag;
      particle.x += piece.vx * dt;
      particle.y += piece.vy * dt;
      particle.rotation += piece.spin * dt;
      // Flipping paper: squash one axis on a sine so pieces seem to tumble in 3D.
      piece.flutter += dt * 9;
      particle.scaleX = piece.width;
      particle.scaleY = piece.height * Math.abs(Math.cos(piece.flutter));
      particle.alpha = Math.min(1, (piece.life - piece.age) / FADE_SECONDS);
    }
    // Nothing flying: skip packing and uploading the idle pool every frame.
    this.renderable = this.live.size > 0;
  }

  reset(): void {
    for (const piece of this.live) {
      piece.particle.alpha = 0;
      this.free.push(piece);
    }
    this.live.clear();
    this.renderable = false;
  }
}

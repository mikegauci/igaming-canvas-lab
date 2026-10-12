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
  /** Piece width in px. */
  size?: number;
  /** Height as a share of width: 0.6 for paper strips, 1 for coins. */
  aspect?: number;
  /** Maximum rotation speed in rad/s (0 keeps pieces upright, e.g. coins). */
  spin?: number;
  /** Axis squashed to fake a 3D tumble: 'y' flips paper end over end, 'x' spins a coin. */
  flip?: 'x' | 'y';
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
  flipX: boolean;
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
  private readonly pieceTexture: Texture;

  /** `texture` is shared by every piece (white by default, tinted per piece). */
  constructor(capacity = 400, texture: Texture = Texture.WHITE) {
    super({ dynamicProperties: { position: true, rotation: true, color: true, vertex: true } });
    this.pieceTexture = texture;
    for (let i = 0; i < capacity; i++) {
      const particle = new Particle({ texture, anchorX: 0.5, anchorY: 0.5 });
      particle.alpha = 0;
      this.addParticle(particle);
      const piece: Piece = {
        particle,
        vx: 0,
        vy: 0,
        spin: 0,
        flutter: 0,
        flipX: false,
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
    aspect = 0.6,
    spin = 7,
    flip = 'y',
    gravity = 1300,
    life = 2.2,
    palette = DEFAULT_PALETTE,
  }: BurstOptions): void {
    const { width: textureWidth, height: textureHeight } = this.pieceTexture;
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
      const scale = 0.7 + Math.random() * 0.6;
      Object.assign(piece, {
        vx: Math.cos(direction) * velocity,
        vy: Math.sin(direction) * velocity,
        spin: (Math.random() * 2 - 1) * spin,
        flutter: Math.random() * Math.PI * 2,
        flipX: flip === 'x',
        gravity,
        width: (size * scale) / textureWidth,
        height: (size * aspect * scale) / textureHeight,
        life: life * (0.75 + Math.random() * 0.5),
        age: 0,
      });
      const { particle } = piece;
      particle.x = x;
      particle.y = y;
      particle.rotation = spin === 0 ? 0 : Math.random() * Math.PI;
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
      // Squash one axis on a sine so pieces seem to tumble (paper) or spin (coins) in 3D.
      piece.flutter += dt * 9;
      const squash = Math.abs(Math.cos(piece.flutter));
      particle.scaleX = piece.width * (piece.flipX ? squash : 1);
      particle.scaleY = piece.height * (piece.flipX ? 1 : squash);
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

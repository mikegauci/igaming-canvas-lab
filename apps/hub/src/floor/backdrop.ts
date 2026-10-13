import { colors } from '@lab/core';
import { Container, Geometry, Graphics, Mesh, Shader } from 'pixi.js';
import { floorFragment, quadVertex, skyFragment } from './synthwave-shaders';

/** Extra art past the design area, so letterboxed screens show more sky and floor, not bars. */
const BLEED = 700;
const RIDGE_FAR = 0x1a0533;
const RIDGE_NEAR = 0x10021f;

/** Deterministic pseudo-random so the mountains don't change between rebuilds. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A rectangle as a two-triangle mesh geometry, in design coordinates. */
function quad(x: number, y: number, width: number, height: number): Geometry {
  return new Geometry({
    attributes: {
      aPosition: [x, y, x + width, y, x + width, y + height, x, y + height],
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });
}

interface Layer {
  view: Container;
  /** How much of the camera's movement this layer follows (0 = fixed, 1 = with the floor). */
  depth: number;
}

/**
 * The synthwave horizon behind the cabinets: a shader sky with stars and a striped sun, two
 * ranges of wireframe mountains in parallax, and a shader grid floor that scrolls toward the
 * viewer. The sky and floor are one quad each, so the whole backdrop is a handful of draw calls.
 */
export class Backdrop extends Container {
  private readonly skyShader = Shader.from({
    gl: { vertex: quadVertex, fragment: skyFragment, name: 'synthwave-sky' },
    resources: {
      sky: {
        uTime: { value: 0, type: 'f32' },
        uHorizon: { value: 0, type: 'f32' },
        uCamera: { value: 0, type: 'f32' },
        uSun: { value: new Float32Array(2), type: 'vec2<f32>' },
        uSunRadius: { value: 0, type: 'f32' },
      },
    },
  });
  private readonly floorShader = Shader.from({
    gl: { vertex: quadVertex, fragment: floorFragment, name: 'synthwave-floor' },
    resources: {
      floor: {
        uTime: { value: 0, type: 'f32' },
        uHorizon: { value: 0, type: 'f32' },
        uCenter: { value: 0, type: 'f32' },
        uCamera: { value: 0, type: 'f32' },
        uGround: { value: 1, type: 'f32' },
      },
    },
  });
  private readonly sky = new Mesh({ geometry: quad(0, 0, 1, 1), shader: this.skyShader });
  private readonly floor = new Mesh({ geometry: quad(0, 0, 1, 1), shader: this.floorShader });
  private readonly mountains = new Container();
  private layers: Layer[] = [];
  private time = 0;

  constructor() {
    super();
    this.addChild(this.sky, this.mountains, this.floor);
  }

  /**
   * `horizon` is where the sky meets the floor; `ground` is where the cabinets stand (it moves
   * 1:1 with the camera). `span` is how far the camera can travel, so wide layers never show an
   * edge.
   */
  build(width: number, height: number, horizon: number, ground: number, span: number): void {
    const left = -BLEED;
    const fullWidth = width + BLEED * 2;
    this.setGeometry(this.sky, quad(left, -BLEED, fullWidth, horizon + BLEED));
    this.setGeometry(this.floor, quad(left, horizon, fullWidth, height + BLEED - horizon));

    const sky = this.skyShader.resources.sky.uniforms;
    sky.uHorizon = horizon;
    // Wider on phones, where the sun shows between the title and the one cabinet in view.
    const radius = Math.min(width * (height > width ? 0.3 : 0.2), 230);
    sky.uSun[0] = width / 2;
    sky.uSun[1] = horizon - radius * 0.28;
    sky.uSunRadius = radius;

    const floor = this.floorShader.resources.floor.uniforms;
    floor.uHorizon = horizon;
    floor.uCenter = width / 2;
    floor.uGround = ground - horizon;

    this.mountains.removeChildren().forEach((child) => child.destroy());
    this.layers = [];
    const random = seeded(11);
    const range = (depth: number, peak: number, fill: number, edge: number, alpha: number) => {
      const view = this.ridge(width, horizon, width + span * depth + BLEED * 2, peak, random);
      view.fill(fill).stroke({ color: edge, width: 1.5, alpha, join: 'round' });
      this.layers.push({ view, depth });
      this.mountains.addChild(view);
    };
    range(0.12, horizon * 0.42, RIDGE_FAR, colors.cyan, 0.45);
    range(0.3, horizon * 0.3, RIDGE_NEAR, colors.neon, 0.8);
  }

  /** Moves the mountains by their share of the camera offset, and the stars and grid with it. */
  setCamera(x: number): void {
    for (const { view, depth } of this.layers) view.x = -x * depth;
    this.skyShader.resources.sky.uniforms.uCamera = x;
    this.floorShader.resources.floor.uniforms.uCamera = x;
  }

  update(seconds: number): void {
    this.time += seconds;
    this.skyShader.resources.sky.uniforms.uTime = this.time;
    this.floorShader.resources.floor.uniforms.uTime = this.time;
  }

  override destroy(...args: Parameters<Container['destroy']>): void {
    super.destroy(...args);
    this.skyShader.destroy();
    this.floorShader.destroy();
  }

  private setGeometry(mesh: Mesh<Geometry, Shader>, geometry: Geometry) {
    const old = mesh.geometry;
    mesh.geometry = geometry;
    old.destroy();
  }

  /**
   * A low-poly mountain range on the horizon, drawn as a filled silhouette with its wireframe:
   * the ridge line plus a line from every peak and dip down to the foot of the range. Peaks are
   * low in the middle, so the sun stays clear.
   */
  private ridge(
    centreWidth: number,
    horizon: number,
    width: number,
    peak: number,
    random: () => number,
  ): Graphics {
    const g = new Graphics();
    const points: [number, number][] = [];
    for (let x = -BLEED; x <= width; x += 26 + random() * 46) {
      const fromCentre = Math.abs(x - centreWidth / 2) / (centreWidth / 2);
      const envelope = Math.min(1, Math.max(0.12, (fromCentre - 0.18) * 1.6));
      const height = peak * envelope * (0.35 + random() * 0.65);
      points.push([x, horizon - height]);
    }
    g.moveTo(-BLEED, horizon);
    for (const [x, y] of points) g.lineTo(x, y);
    g.lineTo(width, horizon).closePath();
    // Wireframe: each vertex drops to a point on the foot, splitting the range into facets.
    points.forEach(([x, y], i) => {
      const next = points[i + 1];
      if (!next || horizon - y < 6) return;
      g.moveTo(x, y).lineTo((x + next[0]) / 2 + (random() - 0.5) * 20, horizon);
    });
    return g;
  }
}

import { AdvancedBloomFilter } from 'pixi-filters';
import { Filter, GlProgram, type Application } from 'pixi.js';
import { frameVertex } from './frame-vertex';
import type { QualitySettings } from './quality';

/** Vignette and film grain in one pass: darker corners pull the eye to the cabinets. */
const gradeFragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vUv;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

void main() {
  vec4 colour = texture(uTexture, vTextureCoord);
  vec2 fromCentre = (vUv - 0.5) * vec2(1.0, 0.8);
  colour.rgb *= mix(0.5, 1.0, smoothstep(0.75, 0.2, length(fromCentre)));
  // Grain changes every frame; per pixel, so it stays fine at any resolution.
  colour.rgb += (hash(gl_FragCoord.xy + fract(uTime * 13.0) * 97.0) - 0.5) * 0.04;
  finalColor = colour;
}
`;

class GradeFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: frameVertex, fragment: gradeFragment, name: 'grade' }),
      resources: { grade: { uTime: { value: 0, type: 'f32' } } },
      // Filters default to resolution 1, and a filtered container renders at its filters' lowest
      // resolution: on a 3× phone that drew the whole floor at a third of its pixels.
      resolution: 'inherit',
    });
  }

  set time(value: number) {
    this.resources.grade.uniforms.uTime = value;
  }
}

/**
 * Full-screen post-processing on the stage: bloom, so every neon tube and the sun actually glow
 * onto what's around them, then the vignette-and-grain grade. Both run at the screen's resolution
 * so the floor stays sharp; medium takes fewer blur passes and the low tier skips both.
 */
export class PostEffects {
  private readonly bloom = new AdvancedBloomFilter({
    // Only the hottest pixels (tube cores, bulbs, the sun) bloom, and gently, so text stays legible.
    threshold: 0.72,
    bloomScale: 0.55,
    brightness: 1,
    blur: 5,
    quality: 5,
  });
  private readonly grade = new GradeFilter();
  private readonly app: Application;
  private time = 0;

  constructor(app: Application) {
    this.app = app;
    // Filters default to resolution 1: render at the screen's, so the floor isn't upscaled.
    this.bloom.resolution = 'inherit';
    // Filter exactly the screen, not the stage's bounds (the backdrop bleeds far past them).
    app.stage.filterArea = app.screen;
    app.ticker.add((ticker) => {
      this.time += ticker.deltaMS / 1000;
      this.grade.time = this.time;
    });
  }

  apply({ bloomPasses }: QualitySettings): void {
    if (bloomPasses === 0) {
      this.app.stage.filters = [];
      return;
    }
    this.bloom.quality = bloomPasses;
    // The blur steps in texture pixels: scale them so the glow spans the same on any screen.
    this.bloom.pixelSize = this.app.renderer.resolution;
    this.app.stage.filters = [this.bloom, this.grade];
  }

  /** Short description for the ?debug=1 panel. */
  describe(): string {
    const filters = this.app.stage.filters;
    return filters && filters.length ? `bloom ×${this.bloom.quality} + grade` : 'post off';
  }
}

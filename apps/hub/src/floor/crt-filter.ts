import { Filter, GlProgram } from 'pixi.js';
import { frameVertex } from './frame-vertex';

/**
 * A small CRT tube for the cabinet screens: barrel curvature, scanlines, a slow rolling bright
 * band, a little chromatic aberration at the edges and a vignette. The maths runs in 0–1 coords
 * across the filtered area (vUv), then maps back to the input texture, which Pixi may have padded.
 */
const fragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vUv;
in vec3 vFrame;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec2 toTexture = vFrame.xy;
  vec2 uv = vUv;
  vec2 centred = uv - 0.5;
  vec2 bent = uv + centred * dot(centred, centred) * 0.22;
  if (bent.x < 0.0 || bent.y < 0.0 || bent.x > 1.0 || bent.y > 1.0) {
    finalColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 at = bent * toTexture;
  vec2 shift = vec2(0.004 * length(centred) * 2.0, 0.0) * toTexture;
  vec4 colour = texture(uTexture, at);
  colour.r = texture(uTexture, at + shift).r;
  colour.b = texture(uTexture, at - shift).b;

  // One dark line every 3 output pixels.
  float scan = 0.78 + 0.22 * sin(bent.y * vFrame.z * 2.094);
  float roll = smoothstep(0.0, 0.12, 0.12 - abs(fract(bent.y - uTime * 0.18) - 0.5)) * 0.12;
  float vignette = 1.0 - dot(centred, centred) * 1.4;
  colour.rgb = colour.rgb * scan * vignette + roll;
  finalColor = vec4(colour.rgb, 1.0);
}
`;

export class CrtFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: frameVertex, fragment, name: 'crt-filter' }),
      resources: { crt: { uTime: { value: 0, type: 'f32' } } },
    });
  }

  set time(value: number) {
    this.resources.crt.uniforms.uTime = value;
  }
}

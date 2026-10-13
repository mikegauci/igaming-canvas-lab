import { Filter, GlProgram } from 'pixi.js';

/**
 * A small CRT tube for the cabinet screens: barrel curvature, scanlines, a slow rolling bright
 * band, a little chromatic aberration at the edges and a vignette. The maths runs in 0–1 coords
 * across the filtered area (vUv), then maps back to the input texture, which Pixi may have padded.
 *
 * The vertex shader is Pixi's default filter vertex plus two varyings. Working out the mapping
 * there means the fragment shader declares none of Pixi's frame uniforms: shared uniforms must
 * have the same precision in both stages, and Pixi gives the stages different defaults.
 */
const vertex = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vUv;
out vec3 vFrame;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);

  vec2 toTexture = uOutputFrame.zw * uInputSize.zw;
  vTextureCoord = aPosition * toTexture;
  vUv = aPosition;
  // Texture-space size of the frame, and its height in pixels (for the scanlines).
  vFrame = vec3(toTexture, uOutputFrame.w);
}
`;

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
      glProgram: GlProgram.from({ vertex, fragment, name: 'crt-filter' }),
      resources: { crt: { uTime: { value: 0, type: 'f32' } } },
    });
  }

  set time(value: number) {
    this.resources.crt.uniforms.uTime = value;
  }
}

/**
 * Pixi's default filter vertex shader plus two varyings: vUv (0–1 across the filtered area) and
 * vFrame (the area's size in texture space, and its height in pixels).
 *
 * Working the mapping out here means fragment shaders need none of Pixi's frame uniforms. Shared
 * uniforms must have the same precision in both stages, Pixi gives the stages different defaults,
 * and redeclaring uInputSize in a fragment shader fails to link.
 */
export const frameVertex = /* glsl */ `
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

/**
 * GLSL for the synthwave backdrop. Both shaders draw a quad in the floor's design coordinates
 * (vPos), so the art is laid out in the same units as the cabinets and HUD.
 */

/** Shared vertex shader: passes the local position through to the fragment shader. */
export const quadVertex = /* glsl */ `
in vec2 aPosition;
out vec2 vPos;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vPos = aPosition;
}
`;

/** The palette, matching the boot screen in style.css. */
const palette = /* glsl */ `
const vec3 NIGHT = vec3(0.027, 0.008, 0.059);   // #07020f
const vec3 DUSK = vec3(0.102, 0.020, 0.200);    // #1a0533
const vec3 PLUM = vec3(0.290, 0.051, 0.310);    // #4a0d4f
const vec3 NEON = vec3(1.0, 0.243, 0.647);      // #ff3ea5
const vec3 GOLD = vec3(1.0, 0.914, 0.369);      // #ffe95e
const vec3 ORANGE = vec3(1.0, 0.604, 0.239);    // #ff9a3d
const vec3 FLOOR = vec3(0.165, 0.031, 0.220);   // #2a0838
`;

/**
 * Sky: a dusk gradient, twinkling stars and the striped sun, whose stripes slide down into the
 * horizon. Stars shift a little with the camera, the sun not at all, so it reads as far away.
 */
export const skyFragment = /* glsl */ `
in vec2 vPos;
out vec4 finalColor;

uniform float uTime;
uniform float uHorizon;
uniform float uCamera;
uniform vec2 uSun;
uniform float uSunRadius;

${palette}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 sky(float t) {
  if (t < 0.45) return mix(NIGHT, DUSK, t / 0.45);
  if (t < 0.8) return mix(DUSK, PLUM, (t - 0.45) / 0.35);
  return mix(PLUM, NEON, pow((t - 0.8) / 0.2, 1.6));
}

float stars(vec2 p) {
  const float CELL = 34.0;
  vec2 cell = floor(p / CELL);
  float seed = hash(cell);
  if (seed < 0.72) return 0.0;
  vec2 centre = (cell + 0.2 + 0.6 * vec2(hash(cell + 7.1), hash(cell + 3.7))) * CELL;
  float size = mix(0.6, 1.6, hash(cell + 1.9));
  float twinkle = 0.6 + 0.4 * sin(uTime * mix(1.0, 3.0, seed) + seed * 40.0);
  return smoothstep(size + 0.8, size - 0.4, length(p - centre)) * twinkle;
}

void main() {
  float t = clamp(vPos.y / uHorizon, 0.0, 1.0);
  vec3 colour = sky(t);
  colour += stars(vPos + vec2(uCamera * 0.04, 0.0)) * pow(1.0 - t, 1.5);

  // Sun: gold at the top to neon at the base, cut by stripes that widen toward the horizon.
  vec2 fromSun = vPos - uSun;
  float distance = length(fromSun);
  float v = clamp((fromSun.y + uSunRadius) / (2.0 * uSunRadius), 0.0, 1.0);
  vec3 sunColour = v < 0.45 ? mix(GOLD, ORANGE, v / 0.45) : mix(ORANGE, NEON, min((v - 0.45) / 0.3, 1.0));
  float period = uSunRadius * 0.12;
  float stripe = fract(fromSun.y / period - uTime * 0.25);
  float gap = smoothstep(0.18, 0.9, v) * 0.7;
  float edge = 1.0 / period;
  float cut = smoothstep(gap - edge, gap + edge, stripe);
  float disc = smoothstep(uSunRadius + 1.0, uSunRadius - 1.0, distance) * mix(1.0, cut, step(0.18, v));
  colour = mix(colour, sunColour, disc);
  colour += NEON * 0.55 * exp(-max(distance - uSunRadius, 0.0) / (uSunRadius * 0.35)) * (1.0 - disc);

  // Haze just above the horizon.
  colour += NEON * 0.5 * exp(-(uHorizon - vPos.y) / 14.0);
  finalColor = vec4(colour, 1.0);
}
`;

/**
 * Floor: an endless neon grid seen in perspective, scrolling toward the viewer. Depth comes from
 * the distance below the horizon (z = K / d), so it needs no 3D geometry. Line widths are worked
 * out analytically in pixels (no derivatives extension), and lines fade out where they would be
 * thinner than a pixel apart, which keeps the horizon free of moiré.
 */
export const floorFragment = /* glsl */ `
in vec2 vPos;
out vec4 finalColor;

uniform float uTime;
uniform float uHorizon;
uniform float uCenter;
uniform float uCamera;
/** Distance below the horizon where things move 1:1 with the camera (the cabinets' feet). */
uniform float uGround;

${palette}

const float K = 520.0;
const float F = 130.0;

/** 1 on a line, 0 away from it; widthPx is the line width and perPx how far 'coord' moves per pixel. */
float gridLine(float coord, float perPx, float widthPx) {
  float distancePx = abs(fract(coord - 0.5) - 0.5) / perPx;
  float core = 1.0 - smoothstep(widthPx * 0.5 - 0.5, widthPx * 0.5 + 0.5, distancePx);
  float glow = exp(-distancePx / (widthPx * 2.5)) * 0.35;
  // Fade lines that would be under ~4 px apart: they only make noise.
  float visible = 1.0 - smoothstep(0.12, 0.3, perPx);
  return (core + glow) * visible;
}

void main() {
  float d = max(vPos.y - uHorizon, 0.5);
  float z = K / d;
  float x = vPos.x - uCenter;
  // Shifting world x by a constant moves near lines more than far ones: free parallax.
  float worldX = x * z / F + uCamera * K / (F * uGround);
  float worldZ = z + uTime * 1.4;

  float width = mix(1.2, 3.0, clamp(d / 320.0, 0.0, 1.0));
  float perPxX = z / F + abs(x) * K / (F * d * d);
  float perPxZ = K / (d * d);
  float lines = max(gridLine(worldX, perPxX, width), gridLine(worldZ, perPxZ, width));

  vec3 colour = mix(FLOOR, NIGHT, clamp(d / 260.0, 0.0, 1.0));
  colour += NEON * lines;
  colour += NEON * 0.85 * exp(-d / 22.0);
  finalColor = vec4(colour, 1.0);
}
`;

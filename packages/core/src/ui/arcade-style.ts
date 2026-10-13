import { FillGradient } from 'pixi.js';
import { fontFamily } from '../theme';

export const arcadeFont = `Orbitron, ${fontFamily}`;

/** Local gradients are baked with text/graphics, without adding filter passes. */
export function verticalGradient(stops: readonly [number, string][]): FillGradient {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    textureSpace: 'local',
    colorStops: stops.map(([offset, color]) => ({ offset, color })),
  });
}

export const chromeFill = () =>
  verticalGradient([
    [0, '#ffffff'],
    [0.28, '#b8f3ff'],
    [0.49, '#5473bc'],
    [0.5, '#f5faff'],
    [0.7, '#ffc1e9'],
    [1, '#fc4da9'],
  ]);

export const metalFill = () =>
  verticalGradient([
    [0, '#8799bd'],
    [0.12, '#d8e6f7'],
    [0.28, '#36405e'],
    [0.54, '#16182f'],
    [0.85, '#42415f'],
    [1, '#8793b0'],
  ]);

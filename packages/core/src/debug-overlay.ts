import {
  RendererType,
  UPDATE_PRIORITY,
  type Application,
  type Container,
  type Ticker,
  type WebGLRenderer,
} from 'pixi.js';

const DRAW_METHODS = [
  'drawElements',
  'drawArrays',
  'drawElementsInstanced',
  'drawArraysInstanced',
] as const;

type GlMethods = Record<string, (...args: unknown[]) => unknown>;

/** Wraps the WebGL draw functions to count calls. Returns a function that restores them. */
function countDrawCalls(gl: object, onDraw: () => void): () => void {
  const target = gl as GlMethods;
  const originals = DRAW_METHODS.filter((name) => typeof target[name] === 'function').map(
    (name) => [name, target[name]!] as const,
  );
  for (const [name, original] of originals) {
    target[name] = function (this: unknown, ...args: unknown[]) {
      onDraw();
      return original.apply(this, args);
    };
  }
  return () => {
    for (const [name] of originals) delete target[name];
  };
}

const countNodes = (node: Container): number =>
  node.children.reduce((total, child) => total + countNodes(child), 1);

/**
 * Small DOM panel with FPS, draw calls per frame and scene-graph size. It lives outside the canvas
 * so it doesn't add draw calls of its own.
 */
export function attachDebugOverlay(app: Application): () => void {
  const panel = document.createElement('div');
  panel.setAttribute('aria-hidden', 'true');
  Object.assign(panel.style, {
    position: 'fixed',
    top: '8px',
    left: '8px',
    zIndex: '9999',
    padding: '6px 8px',
    borderRadius: '4px',
    background: 'rgba(0, 0, 0, 0.72)',
    color: '#3ef0ff',
    font: '12px/1.4 ui-monospace, Menlo, monospace',
    whiteSpace: 'pre',
    pointerEvents: 'none',
  });
  document.body.appendChild(panel);

  const renderer = app.renderer;
  let draws = 0;
  let lastFrameDraws = 0;
  const restoreGl =
    renderer.type === RendererType.WEBGL
      ? countDrawCalls((renderer as WebGLRenderer).gl, () => draws++)
      : undefined;

  let sinceRefresh = Infinity;
  // UTILITY priority runs after the app renders (LOW), so `draws` covers exactly one frame.
  const tick = (ticker: Ticker) => {
    lastFrameDraws = draws;
    draws = 0;
    sinceRefresh += ticker.deltaMS;
    if (sinceRefresh < 250) return;
    sinceRefresh = 0;
    const { width, height } = renderer.screen;
    panel.textContent = [
      `${Math.round(ticker.FPS)} fps`,
      `${restoreGl ? lastFrameDraws : 'n/a'} draw calls`,
      `${countNodes(app.stage)} nodes`,
      `${renderer.name} ${Math.round(width)}×${Math.round(height)} @${renderer.resolution}x`,
    ].join('\n');
  };
  app.ticker.add(tick, undefined, UPDATE_PRIORITY.UTILITY);

  return () => {
    app.ticker.remove(tick);
    restoreGl?.();
    panel.remove();
  };
}

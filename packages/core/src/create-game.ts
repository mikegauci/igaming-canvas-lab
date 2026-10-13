import { Application, Container } from 'pixi.js';
import { attachDebugOverlay } from './debug-overlay';
import { SceneManager, type Viewport } from './scene';

export interface GameOptions {
  /** Element the canvas is appended to. */
  parent: HTMLElement;
  /** Fixed design resolution; the stage is letterboxed to fit the window. */
  designWidth: number;
  designHeight: number;
  /** Optional design size used when the screen is taller than it is wide. */
  portrait?: { width: number; height: number };
  background?: string;
  /** Caps devicePixelRatio to keep fill-rate sane on high-DPI phones. */
  maxResolution?: number;
  /** Shows FPS and draw calls. Defaults to on when the URL has `?debug=1`. */
  debug?: boolean;
  /** Extra lines for the debug panel, e.g. the current quality tier. */
  debugInfo?: () => string;
}

export interface Game {
  app: Application;
  /** Root container in design coordinates (viewport.width × viewport.height). */
  root: Container;
  scenes: SceneManager;
  readonly viewport: Viewport;
  /** Whether the stats panel (FPS, draw calls…) is showing. */
  debug: boolean;
  destroy(): void;
}

const debugFromQuery = () => new URLSearchParams(window.location.search).get('debug') === '1';

export async function createGame(options: GameOptions): Promise<Game> {
  const {
    parent,
    designWidth,
    designHeight,
    portrait,
    background = '#0b0b14',
    maxResolution = 2,
    debug = debugFromQuery(),
    debugInfo,
  } = options;

  const app = new Application();
  await app.init({
    background,
    resizeTo: parent,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio, maxResolution),
  });
  parent.appendChild(app.canvas);

  const root = new Container();
  app.stage.addChild(root);

  const viewportFor = (width: number, height: number): Viewport =>
    portrait && height > width
      ? { width: portrait.width, height: portrait.height, orientation: 'portrait' }
      : { width: designWidth, height: designHeight, orientation: 'landscape' };

  let viewport = viewportFor(app.screen.width, app.screen.height);
  const scenes = new SceneManager(root, app.ticker, viewport);

  const fit = () => {
    const { width, height } = app.screen;
    const next = viewportFor(width, height);
    const scale = Math.min(width / next.width, height / next.height);
    root.scale.set(scale);
    root.position.set((width - next.width * scale) / 2, (height - next.height * scale) / 2);
    if (next.orientation !== viewport.orientation) {
      viewport = next;
      scenes.resize(viewport);
    }
  };
  app.renderer.on('resize', fit);
  fit();

  // Pause the ticker while the tab is hidden so animations don't jump on return.
  const onVisibility = () => (document.hidden ? app.ticker.stop() : app.ticker.start());
  document.addEventListener('visibilitychange', onVisibility);

  let detachDebug = debug ? attachDebugOverlay(app, debugInfo) : undefined;

  return {
    app,
    root,
    scenes,
    get viewport() {
      return viewport;
    },
    get debug() {
      return detachDebug !== undefined;
    },
    set debug(on: boolean) {
      if (on && !detachDebug) detachDebug = attachDebugOverlay(app, debugInfo);
      if (!on && detachDebug) {
        detachDebug();
        detachDebug = undefined;
      }
    },
    destroy() {
      document.removeEventListener('visibilitychange', onVisibility);
      detachDebug?.();
      app.destroy(true, { children: true });
    },
  };
}

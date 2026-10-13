import { Application, Container } from 'pixi.js';
import { attachDebugOverlay } from './debug-overlay';
import { SceneManager, type Viewport } from './scene';
import { localStore } from './storage';

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
  /**
   * Shows FPS and draw calls. Defaults to on when the URL has `?debug=1`, or when the player left
   * the stats panel open in the hub or any game.
   */
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
  /** Whether the stats panel (FPS, draw calls…) is showing. Setting it is remembered. */
  debug: boolean;
  destroy(): void;
}

/** Shared by the hub and every game, so the stats toggle carries between them. */
const STATS_KEY = 'lab:stats';
const statsStore = localStore();
const debugFromQuery = () => new URLSearchParams(window.location.search).get('debug') === '1';

export async function createGame(options: GameOptions): Promise<Game> {
  const {
    parent,
    designWidth,
    designHeight,
    portrait,
    background = '#0b0b14',
    maxResolution = 2,
    debug = debugFromQuery() || statsStore.get(STATS_KEY) === '1',
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

  const viewportFor = (width: number, height: number): Viewport => {
    const design =
      portrait && height > width
        ? { width: portrait.width, height: portrait.height, orientation: 'portrait' as const }
        : { width: designWidth, height: designHeight, orientation: 'landscape' as const };
    const scale = Math.min(width / design.width, height / design.height);
    const screenWidth = width / scale;
    const screenHeight = height / scale;
    const screen = {
      x: (design.width - screenWidth) / 2,
      y: (design.height - screenHeight) / 2,
      width: screenWidth,
      height: screenHeight,
    };
    return { ...design, screen };
  };

  let viewport = viewportFor(app.screen.width, app.screen.height);
  const scenes = new SceneManager(root, app.ticker, viewport);

  const fit = () => {
    const { width, height } = app.screen;
    const next = viewportFor(width, height);
    const scale = Math.min(width / next.width, height / next.height);
    root.scale.set(scale);
    root.position.set((width - next.width * scale) / 2, (height - next.height * scale) / 2);
    // Re-lay out whenever the letterbox changes too, so full-screen layers keep covering it.
    const { screen } = viewport;
    if (
      next.orientation !== viewport.orientation ||
      next.screen.width !== screen.width ||
      next.screen.height !== screen.height
    ) {
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
      statsStore.set(STATS_KEY, on ? '1' : '0');
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

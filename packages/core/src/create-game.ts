import { Application, Container } from 'pixi.js';

export interface GameOptions {
  /** Element the canvas is appended to. */
  parent: HTMLElement;
  /** Fixed design resolution; the stage is letterboxed to fit the window. */
  designWidth: number;
  designHeight: number;
  background?: string;
  /** Caps devicePixelRatio to keep fill-rate sane on high-DPI phones. */
  maxResolution?: number;
}

export interface Game {
  app: Application;
  /** Root container in design coordinates (designWidth × designHeight). */
  root: Container;
  destroy(): void;
}

export async function createGame(options: GameOptions): Promise<Game> {
  const { parent, designWidth, designHeight, background = '#0b0b14', maxResolution = 2 } = options;

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

  const fit = () => {
    const { width, height } = app.screen;
    const scale = Math.min(width / designWidth, height / designHeight);
    root.scale.set(scale);
    root.position.set((width - designWidth * scale) / 2, (height - designHeight * scale) / 2);
  };
  app.renderer.on('resize', fit);
  fit();

  // Pause the ticker while the tab is hidden so animations don't jump on return.
  const onVisibility = () => (document.hidden ? app.ticker.stop() : app.ticker.start());
  document.addEventListener('visibilitychange', onVisibility);

  return {
    app,
    root,
    destroy() {
      document.removeEventListener('visibilitychange', onVisibility);
      app.destroy(true, { children: true });
    },
  };
}

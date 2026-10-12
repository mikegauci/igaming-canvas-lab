import { Assets, Graphics, Text, type AssetsManifest } from 'pixi.js';
import { Scene, type Viewport } from './scene';
import { colors, fontFamily } from './theme';

let initialized = false;

export interface LoadOptions {
  manifest: AssetsManifest;
  bundles: string | string[];
  /** 0..1 across all requested bundles. */
  onProgress?: (progress: number) => void;
  /** Prefix for asset URLs. Defaults to the app's Vite `base`, so `/slot/` deep links resolve. */
  basePath?: string;
}

/** Registers the manifest once, then loads the requested bundles. */
export async function loadAssets({
  manifest,
  bundles,
  onProgress,
  basePath = import.meta.env.BASE_URL,
}: LoadOptions): Promise<void> {
  if (!initialized) {
    await Assets.init({ manifest, basePath });
    initialized = true;
  }
  await Assets.loadBundle(bundles, onProgress);
}

const BAR_WIDTH = 360;
const BAR_HEIGHT = 10;

/** Title, progress bar and percentage. Drive it with `progress` while assets load. */
export class LoadingScene extends Scene {
  private readonly title: Text;
  private readonly track = new Graphics()
    .roundRect(0, 0, BAR_WIDTH, BAR_HEIGHT, BAR_HEIGHT / 2)
    .fill({ color: colors.text, alpha: 0.12 });
  private readonly fill = new Graphics()
    .roundRect(0, 0, BAR_WIDTH, BAR_HEIGHT, BAR_HEIGHT / 2)
    .fill(colors.neon);
  private readonly percent = new Text({
    text: '0%',
    style: { fontFamily, fontSize: 18, fill: colors.muted },
  });

  constructor(title = 'Loading') {
    super();
    this.title = new Text({
      text: title,
      style: { fontFamily, fontSize: 40, fontWeight: '700', fill: colors.text, letterSpacing: 2 },
    });
    this.title.anchor.set(0.5, 1);
    this.percent.anchor.set(0.5, 0);
    this.fill.scale.x = 0;
    this.addChild(this.title, this.track, this.fill, this.percent);
  }

  set progress(value: number) {
    const p = Math.min(1, Math.max(0, value));
    this.fill.scale.x = p;
    this.percent.text = `${Math.round(p * 100)}%`;
  }

  override resize({ width, height }: Viewport): void {
    const cx = width / 2;
    const cy = height / 2;
    this.title.position.set(cx, cy - 24);
    this.track.position.set(cx - BAR_WIDTH / 2, cy);
    this.fill.position.copyFrom(this.track.position);
    this.percent.position.set(cx, cy + BAR_HEIGHT + 14);
  }
}

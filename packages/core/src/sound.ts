import { sound, type PlayOptions } from '@pixi/sound';
import { BackgroundMusic } from './background-music';
import { localStore, type KeyValueStore } from './storage';
import { renderWav, type Tone } from './synth';

type Listener = (muted: boolean) => void;

/**
 * Sound effects and shared retrowave music with a mute toggle remembered across visits.
 * Sounds come from Assets (importing @pixi/sound registers the audio loader) or from `synth`.
 */
export class SoundManager {
  private _muted: boolean;
  private listeners = new Set<Listener>();
  private readonly music?: BackgroundMusic;
  private readonly detach: () => void;
  private destroyed = false;

  constructor(
    private readonly store: KeyValueStore = localStore(),
    private readonly storageKey = 'lab:muted',
  ) {
    this._muted = store.get(storageKey) === '1';
    if (this._muted) sound.muteAll();
    else sound.unmuteAll();
    const context = sound.context.audioContext;
    if (context) this.music = new BackgroundMusic(context, this._muted);

    // Browsers start audio suspended until a user gesture. @pixi/sound resumes on pointer
    // events; keyboard players (Space = spin) need this too. Keep gesture listeners so audio
    // can also recover if a mobile browser interrupts the context later.
    let pageActive = true;
    const stopListening = () => {
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('pointerdown', unlock);
    };
    const ready = () => {
      if (this.destroyed || (context && context.state !== 'running')) return;
      if (pageActive && !document.hidden) void this.music?.start();
    };
    const unlock = () => {
      if (this.destroyed || !pageActive || document.hidden) return;
      if (!context || context.state === 'running') return ready();
      void context.resume().then(ready, () => undefined);
    };
    const visibility = () => {
      if (document.hidden) this.music?.pause();
      else unlock();
    };
    const pagehide = () => {
      pageActive = false;
      this.music?.pause();
    };
    const pageshow = () => {
      pageActive = true;
      visibility();
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('pageshow', pageshow);
    document.addEventListener('visibilitychange', visibility);
    this.detach = () => {
      stopListening();
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', pageshow);
      document.removeEventListener('visibilitychange', visibility);
    };
    // Navigation within an already-activated site may allow an immediate resume.
    unlock();
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    if (muted === this._muted) return;
    this._muted = muted;
    if (muted) sound.muteAll();
    else sound.unmuteAll();
    this.music?.setMuted(muted);
    this.store.set(this.storageKey, muted ? '1' : '0');
    for (const listener of this.listeners) listener(muted);
  }

  toggle(): void {
    this.setMuted(!this._muted);
  }

  /** Registers generated sounds, e.g. `{ click: [{ freq: 900, duration: 0.03 }] }`. */
  synth(sounds: Record<string, readonly Tone[]>): void {
    for (const [alias, tones] of Object.entries(sounds)) {
      if (!sound.exists(alias)) sound.add(alias, { source: renderWav(tones), preload: true });
    }
  }

  /** Plays a loaded sound by alias. Missing sounds are ignored so audio never breaks gameplay. */
  play(alias: string, options?: PlayOptions): void {
    if (sound.exists(alias)) void sound.play(alias, options);
  }

  stop(alias: string): void {
    if (sound.exists(alias)) sound.stop(alias);
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.destroyed = true;
    this.detach();
    this.music?.destroy();
    this.listeners.clear();
  }
}

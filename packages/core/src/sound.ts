import { sound, type PlayOptions } from '@pixi/sound';
import { localStore, type KeyValueStore } from './storage';
import { renderWav, type Tone } from './synth';

type Listener = (muted: boolean) => void;

/**
 * Thin wrapper over @pixi/sound with a mute toggle that is remembered across visits.
 * Sounds come from Assets (importing @pixi/sound registers the audio loader) or from `synth`.
 */
export class SoundManager {
  private _muted: boolean;
  private listeners = new Set<Listener>();

  constructor(
    private readonly store: KeyValueStore = localStore(),
    private readonly storageKey = 'lab:muted',
  ) {
    this._muted = store.get(storageKey) === '1';
    if (this._muted) sound.muteAll();

    // Browsers start audio suspended until a user gesture. @pixi/sound resumes on pointer
    // events; keyboard players (Space = spin) need this too. Keep listening until the context
    // is actually running: some keys (e.g. Escape) don't count as a gesture.
    const stopListening = () => {
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('pointerdown', unlock);
    };
    const unlock = () => {
      const context = sound.context.audioContext;
      if (!context || context.state === 'running') return stopListening();
      context.resume().then(
        () => context.state === 'running' && stopListening(),
        () => undefined,
      );
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    if (muted === this._muted) return;
    this._muted = muted;
    if (muted) sound.muteAll();
    else sound.unmuteAll();
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
}

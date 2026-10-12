import { sound, type PlayOptions } from '@pixi/sound';
import { localStore, type KeyValueStore } from './storage';

type Listener = (muted: boolean) => void;

/**
 * Thin wrapper over @pixi/sound with a mute toggle that is remembered across visits.
 * Sounds are loaded through Assets (importing @pixi/sound registers the audio loader).
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

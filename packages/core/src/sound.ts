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

    // iOS plays Web Audio on the "ambient" channel, which the silent switch mutes, so phones on
    // silent hear nothing. Games want the media channel, like a video would use (Safari 17+).
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';

    // Browsers start audio suspended until a user gesture. On touch screens only the end of a
    // tap counts (pointerdown doesn't), and keyboard players (Space = spin) need unlocking too.
    // iOS also suspends ("interrupted") the context on a call or when the tab is backgrounded,
    // so keep listening for the whole session and resume whenever it isn't running.
    const unlock = () => {
      const context = sound.context.audioContext;
      if (context && context.state !== 'running') context.resume().catch(() => undefined);
    };
    for (const type of ['pointerup', 'touchend', 'keydown']) {
      window.addEventListener(type, unlock, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') unlock();
    });
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

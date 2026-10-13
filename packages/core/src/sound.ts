import { sound, type PlayOptions } from '@pixi/sound';
import { BackgroundMusic } from './background-music';
import { localStore, type KeyValueStore } from './storage';
import { renderWav, type Tone } from './synth';

type Listener = (muted: boolean) => void;

/**
 * Sound effects and shared music with independent mute toggles remembered across visits.
 * Sounds come from Assets (importing @pixi/sound registers the audio loader) or from `synth`.
 */
export class SoundManager {
  private _muted: boolean;
  private _musicMuted: boolean;
  private listeners = new Set<Listener>();
  private musicListeners = new Set<Listener>();
  private readonly music?: BackgroundMusic;
  private readonly detach: () => void;
  private destroyed = false;

  constructor(
    private readonly store: KeyValueStore = localStore(),
    private readonly storageKey = 'lab:muted',
  ) {
    this._muted = store.get(storageKey) === '1';
    const savedMusic = store.get(`${storageKey}:music`);
    // Preserve an existing all-audio mute on the first visit with separate controls.
    this._musicMuted = savedMusic === null ? this._muted : savedMusic === '1';
    if (savedMusic === null) store.set(`${storageKey}:music`, this._musicMuted ? '1' : '0');
    if (this._muted) sound.muteAll();
    else sound.unmuteAll();
    const context = sound.context.audioContext;
    if (context) this.music = new BackgroundMusic(context, this._musicMuted);

    // iOS routes Web Audio through the ringer channel by default, so the silent switch mutes the
    // whole site. Declaring playback makes it behave like media.
    const audioSession = (navigator as Navigator & { audioSession?: { type: string } })
      .audioSession;
    if (audioSession) audioSession.type = 'playback';

    // Browsers start audio suspended until a user gesture. On touch screens a tap only counts once
    // the finger lifts (pointerup/touchend), not on pointerdown, so listen for every gesture event;
    // keyboard players (Space = spin) need this too. Keep the listeners so audio can also recover
    // if a mobile browser interrupts the context later.
    const gestures = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
    let pageActive = true;
    const stopListening = () => {
      for (const type of gestures) window.removeEventListener(type, unlock, true);
      context?.removeEventListener('statechange', ready);
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
    for (const type of gestures) window.addEventListener(type, unlock, true);
    // Start music whenever the context starts running, whoever resumed it (@pixi/sound unlocks
    // on touchend too), so the first tap is always enough.
    context?.addEventListener('statechange', ready);
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

  /**
   * Whether the browser lets this page play audio right now, without waiting for a gesture.
   * Some browsers allow it (e.g. Chrome for sites a player often uses); mobile ones don't.
   */
  async canPlayWithoutGesture(): Promise<boolean> {
    const context = sound.context.audioContext;
    if (!context || context.state === 'running') return true;
    // A blocked resume can stay pending rather than reject, so give it a moment only.
    await Promise.race([context.resume().catch(() => undefined), wait(150)]);
    return (context.state as string) === 'running';
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

  get musicMuted(): boolean {
    return this._musicMuted;
  }

  setMusicMuted(muted: boolean): void {
    if (muted === this._musicMuted) return;
    this._musicMuted = muted;
    this.music?.setMuted(muted);
    this.store.set(`${this.storageKey}:music`, muted ? '1' : '0');
    for (const listener of this.musicListeners) listener(muted);
  }

  toggleMusic(): void {
    this.setMusicMuted(!this._musicMuted);
  }

  onMusicChange(listener: Listener): () => void {
    this.musicListeners.add(listener);
    return () => this.musicListeners.delete(listener);
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
    this.musicListeners.clear();
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

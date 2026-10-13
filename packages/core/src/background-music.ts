import { renderRetrowaveWav } from './retrowave';
import { sessionStore, type KeyValueStore } from './storage';

const POSITION_KEY = 'lab:music-position';
const VOLUME = 0.45;

/** One looping source, using the same AudioContext as the game's sound effects. */
export class BackgroundMusic {
  private readonly gain: GainNode;
  private buffer?: Promise<AudioBuffer>;
  private source?: AudioBufferSourceNode;
  private offset: number;
  private startedAt = 0;
  private wanted = false;
  private destroyed = false;

  constructor(
    private readonly context: AudioContext,
    muted: boolean,
    private readonly store: KeyValueStore = sessionStore(),
  ) {
    const saved = Number(store.get(POSITION_KEY));
    this.offset = Number.isFinite(saved) && saved >= 0 ? saved : 0;
    this.gain = context.createGain();
    this.gain.gain.value = muted ? 0 : VOLUME;
    this.gain.connect(context.destination);
  }

  setMuted(muted: boolean): void {
    this.gain.gain.setTargetAtTime(muted ? 0 : VOLUME, this.context.currentTime, 0.025);
  }

  async start(): Promise<void> {
    if (this.destroyed || this.source) return;
    this.wanted = true;
    try {
      // Generate and decode only once, after audio is unlocked, keeping boot work light.
      this.buffer ??= this.context.decodeAudioData(renderRetrowaveWav());
      const buffer = await this.buffer;
      if (!this.wanted || this.destroyed || this.source || this.context.state !== 'running') return;
      this.offset %= buffer.duration;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.gain);
      source.start(0, this.offset);
      this.startedAt = this.context.currentTime;
      this.source = source;
    } catch {
      // Audio is optional: decode/device failures must never interrupt gameplay.
      this.buffer = undefined;
    }
  }

  pause(): void {
    this.wanted = false;
    if (this.source) {
      this.offset =
        (this.offset + this.context.currentTime - this.startedAt) % this.source.buffer!.duration;
      this.source.stop();
      this.source.disconnect();
      this.source = undefined;
    }
    // Keep musical position when moving between the lobby and the separate game pages.
    this.store.set(POSITION_KEY, String(this.offset));
  }

  destroy(): void {
    this.destroyed = true;
    this.pause();
    this.gain.disconnect();
  }
}

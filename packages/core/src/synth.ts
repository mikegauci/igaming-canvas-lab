/**
 * Tiny offline synthesiser: renders short tones to a 16-bit mono WAV so games get UI sounds
 * without shipping audio files. Pure (no Web Audio), so it can be unit-tested.
 */
export interface Tone {
  /** Start frequency in Hz (ignored for noise). */
  freq: number;
  /** Optional end frequency for a linear pitch slide. */
  to?: number;
  /** Seconds. */
  duration: number;
  /** Seconds from the start of the clip. */
  delay?: number;
  wave?: 'sine' | 'triangle' | 'square' | 'saw' | 'noise';
  /** 0..1 peak amplitude. */
  volume?: number;
}

const TWO_PI = Math.PI * 2;
const ATTACK = 0.005;

const oscillators = {
  sine: (phase: number) => Math.sin(phase * TWO_PI),
  triangle: (phase: number) => 1 - 4 * Math.abs(phase - 0.5),
  square: (phase: number) => (phase < 0.5 ? 1 : -1),
  saw: (phase: number) => 2 * phase - 1,
};

export function renderWav(tones: readonly Tone[], sampleRate = 22050): ArrayBuffer {
  const length = Math.ceil(
    Math.max(0, ...tones.map((t) => (t.delay ?? 0) + t.duration)) * sampleRate,
  );
  const mix = new Float32Array(length);
  let noiseState = 0x2545f491;

  for (const { freq, to = freq, duration, delay = 0, wave = 'sine', volume = 0.3 } of tones) {
    const start = Math.floor(delay * sampleRate);
    const count = Math.floor(duration * sampleRate);
    let phase = 0;
    for (let i = 0; i < count && start + i < length; i++) {
      const t = i / sampleRate;
      // Fast attack, then exponential-ish decay to silence at the end of the tone.
      const envelope = Math.min(1, t / ATTACK) * (1 - i / count) ** 2;
      let sample: number;
      if (wave === 'noise') {
        noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
        sample = noiseState / 2147483648 - 1;
      } else {
        sample = oscillators[wave](phase);
        phase = (phase + (freq + (to - freq) * (i / count)) / sampleRate) % 1;
      }
      mix[start + i]! += sample * envelope * volume;
    }
  }

  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, mix[i]!)) * 0x7fff, true);
  }
  return buffer;
}

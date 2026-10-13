import { describe, expect, it } from 'vitest';
import { renderRetrowaveWav, RETROWAVE_SECONDS } from './retrowave';

describe('retrowave loop', () => {
  it('renders an exact musical loop with audible, unclipped music throughout', () => {
    const sampleRate = 8000;
    const wav = new DataView(renderRetrowaveWav(sampleRate));
    const count = wav.getUint32(40, true) / 2;
    expect(count).toBe(RETROWAVE_SECONDS * sampleRate);
    let clipped = 0;
    for (let second = 0; second < RETROWAVE_SECONDS; second++) {
      let energy = 0;
      for (let i = second * sampleRate; i < (second + 1) * sampleRate; i++) {
        const sample = wav.getInt16(44 + i * 2, true);
        energy += (sample / 32767) ** 2;
        if (Math.abs(sample) >= 32767) clipped++;
      }
      expect(Math.sqrt(energy / sampleRate)).toBeGreaterThan(0.02);
    }
    expect(clipped).toBe(0);
    // Both edges reach zero, avoiding a discontinuity each time the buffer loops.
    expect(wav.getInt16(44, true)).toBe(0);
    expect(Math.abs(wav.getInt16(wav.byteLength - 2, true))).toBeLessThan(10);
  });
});

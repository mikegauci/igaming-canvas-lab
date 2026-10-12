import { describe, expect, it } from 'vitest';
import { renderWav } from './synth';

const text = (view: DataView, offset: number, length: number) =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));

describe('renderWav', () => {
  it('writes a valid 16-bit mono PCM header', () => {
    const view = new DataView(renderWav([{ freq: 440, duration: 0.1 }], 8000));
    expect(text(view, 0, 4)).toBe('RIFF');
    expect(text(view, 8, 4)).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(800 * 2);
    expect(view.byteLength).toBe(44 + 800 * 2);
  });

  it('lasts until the end of the latest tone', () => {
    const view = new DataView(
      renderWav(
        [
          { freq: 440, duration: 0.1 },
          { freq: 660, duration: 0.1, delay: 0.15 },
        ],
        1000,
      ),
    );
    expect(view.getUint32(40, true) / 2).toBe(250);
  });

  it('stays silent before a delayed tone and makes sound during it', () => {
    const view = new DataView(renderWav([{ freq: 300, duration: 0.1, delay: 0.1 }], 1000));
    const sample = (i: number) => view.getInt16(44 + i * 2, true);
    expect(Array.from({ length: 100 }, (_, i) => sample(i)).every((s) => s === 0)).toBe(true);
    expect(Array.from({ length: 50 }, (_, i) => Math.abs(sample(100 + i))).some((s) => s > 0)).toBe(
      true,
    );
  });

  it('clips loud mixes instead of wrapping around', () => {
    // Five in-phase squares at full volume sum to ~3× full scale here. Without clamping, the
    // int16 conversion would wrap that to an unrelated value.
    const loud = Array.from({ length: 5 }, () => ({
      freq: 10,
      duration: 0.05,
      wave: 'square' as const,
      volume: 1,
    }));
    const view = new DataView(renderWav(loud, 1000));
    expect(view.getInt16(44 + 10 * 2, true)).toBe(0x7fff);
  });
});

import { renderWav, type Tone } from './synth';

/** Original 120 BPM, sixteen-bar A-minor retrowave loop; no downloaded audio assets. */
export const RETROWAVE_SECONDS = 32;

const note = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const chords = [
  [45, 57, 60, 64, 67], // Am7
  [41, 53, 57, 60, 64], // Fmaj7
  [48, 55, 60, 64, 67], // C
  [43, 55, 59, 62, 67], // G
] as const;

export function renderRetrowaveWav(sampleRate = 22050): ArrayBuffer {
  // A silent tone fixes the clip to the musical grid, regardless of the last note's release.
  const tones: Tone[] = [{ freq: 0, duration: RETROWAVE_SECONDS, volume: 0 }];
  const add = (tone: Tone) => {
    const remaining = RETROWAVE_SECONDS - (tone.delay ?? 0);
    if (remaining > 0) tones.push({ ...tone, duration: Math.min(tone.duration, remaining) });
  };

  for (let bar = 0; bar < 16; bar++) {
    const chord = chords[Math.floor(bar / 2) % chords.length]!;
    const time = bar * 2;

    // Detuned, warm chord bed. Long overlapping releases keep the backing soft.
    for (const midi of chord.slice(1)) {
      for (const detune of [0.997, 1.003]) {
        add({
          freq: note(midi) * detune,
          delay: time,
          duration: 2,
          wave: 'triangle',
          volume: 0.045,
        });
      }
    }

    for (let step = 0; step < 8; step++) {
      const at = time + step * 0.25;
      // Pulsing octave bass underneath a bright, dotted-delay arpeggio.
      const bass = note(chord[0] + (step % 2 ? 12 : 0));
      add({ freq: bass, delay: at, duration: 0.22, wave: 'saw', volume: 0.075 });
      add({ freq: bass / 2, delay: at, duration: 0.23, wave: 'sine', volume: 0.12 });
      const arp = note(chord[1 + [0, 2, 1, 3, 2, 1, 3, 2][step]!]! + 12);
      add({ freq: arp, delay: at, duration: 0.23, wave: 'triangle', volume: 0.085 });
      add({
        freq: arp * 1.002,
        delay: at + 0.375,
        duration: 0.22,
        wave: 'triangle',
        volume: 0.027,
      });

      // Eighth-note hats, with quieter offbeats.
      add({ freq: 0, delay: at, duration: step % 2 ? 0.06 : 0.035, wave: 'noise', volume: 0.045 });
    }

    for (let beat = 0; beat < 4; beat++) {
      const at = time + beat * 0.5;
      add({ freq: 125, to: 42, delay: at, duration: 0.18, wave: 'sine', volume: 0.42 });
      if (beat % 2) {
        // Snare body and gated noise on beats two and four.
        add({ freq: 185, to: 110, delay: at, duration: 0.12, volume: 0.14 });
        add({ freq: 0, delay: at, duration: 0.15, wave: 'noise', volume: 0.17 });
        add({ freq: 0, delay: at + 0.012, duration: 0.09, wave: 'noise', volume: 0.075 });
      }
    }

    // A small melodic lift in the second half; the first half leaves room for game effects.
    if (bar >= 8) {
      for (const [index, degree] of [2, 3, 1, 2].entries()) {
        const freq = note(chord[degree]! + 12);
        add({
          freq,
          delay: time + index * 0.5 + 0.25,
          duration: 0.45,
          wave: 'triangle',
          volume: 0.07,
        });
      }
    }
  }

  return renderWav(tones, sampleRate);
}

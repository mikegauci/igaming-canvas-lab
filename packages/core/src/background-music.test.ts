import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundMusic } from './background-music';
import { memoryStore } from './storage';

const fetchTrack = vi.fn();
const trackBytes = new ArrayBuffer(44);

beforeEach(() => {
  fetchTrack.mockReset();
  fetchTrack.mockResolvedValue({ ok: true, arrayBuffer: async () => trackBytes });
  vi.stubGlobal('fetch', fetchTrack);
});

afterEach(() => vi.unstubAllGlobals());

function audio() {
  const gain = {
    gain: { value: 1, setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const sources: {
    buffer: AudioBuffer | null;
    loop: boolean;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: () => gain,
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 28.8 }),
    createBufferSource: () => {
      const source = {
        buffer: null,
        loop: false,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      };
      sources.push(source);
      return source;
    },
  };
  return {
    context,
    gain,
    sources,
    music: (store = memoryStore(), muted = false) =>
      new BackgroundMusic(context as unknown as AudioContext, muted, store),
  };
}

describe('BackgroundMusic', () => {
  it('decodes once and prevents overlapping loops when unlock fires repeatedly', async () => {
    const { context, sources, music } = audio();
    const track = music();
    await Promise.all([track.start(), track.start(), track.start()]);
    expect(fetchTrack).toHaveBeenCalledOnce();
    expect(fetchTrack).toHaveBeenCalledWith(expect.stringContaining('icl-background-loop.wav'));
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledWith(trackBytes);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.loop).toBe(true);
    expect(sources[0]!.start).toHaveBeenCalledWith(0, 0);
  });

  it('pauses, then resumes at the same position with the whole buffer still looping', async () => {
    const { context, sources, music } = audio();
    const store = memoryStore();
    const track = music(store);
    await track.start();
    context.currentTime = 37;
    track.pause();
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
    expect(Number(store.get('lab:music-position'))).toBeCloseTo(8.2);
    context.currentTime = 100;
    await track.start();
    expect(sources[1]!.start).toHaveBeenCalledWith(0, expect.closeTo(8.2));
    expect(sources[1]!.loop).toBe(true);
    expect(context.decodeAudioData).toHaveBeenCalledOnce();
    expect(fetchTrack).toHaveBeenCalledOnce();
  });

  it('carries musical position into a new page, even with an invalid stored position', async () => {
    const { sources, music } = audio();
    await music(memoryStore({ 'lab:music-position': '69' })).start();
    expect(sources[0]!.start).toHaveBeenCalledWith(0, expect.closeTo(11.4));
    await music(memoryStore({ 'lab:music-position': 'NaN' })).start();
    expect(sources[1]!.start).toHaveBeenCalledWith(0, 0);
  });

  it('does not start in a hidden/disposed page while decoding is in flight', async () => {
    const { context, sources, music } = audio();
    let decoded!: (value: { duration: number }) => void;
    context.decodeAudioData.mockReturnValue(
      new Promise((resolve) => {
        decoded = resolve;
      }),
    );
    const track = music();
    const loading = track.start();
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
    track.pause();
    decoded({ duration: 28.8 });
    await loading;
    expect(sources).toHaveLength(0);
    await track.start();
    expect(sources).toHaveLength(1);
    track.destroy();
    await track.start();
    expect(sources).toHaveLength(1);
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
  });

  it('starts muted and fades the music gain with the shared sound setting', async () => {
    const { gain, music } = audio();
    const track = music(memoryStore(), true);
    expect(gain.gain.value).toBe(0);
    await track.start();
    track.setMuted(false);
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.28, 0, 0.025);
    track.setMuted(true);
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.025);
  });

  it('contains decoding failures and allows a later retry', async () => {
    const { context, sources, music } = audio();
    context.decodeAudioData.mockRejectedValueOnce(new Error('Audio device unavailable'));
    const track = music();
    await expect(track.start()).resolves.toBeUndefined();
    expect(sources).toHaveLength(0);
    await track.start();
    expect(sources).toHaveLength(1);
  });

  it.each([
    () => Promise.reject(new Error('Offline')),
    () => Promise.resolve({ ok: false, status: 404 }),
  ])('contains download failures and allows a later retry', async (failure) => {
    const { context, sources, music } = audio();
    fetchTrack.mockImplementationOnce(failure);
    const track = music();
    await expect(track.start()).resolves.toBeUndefined();
    expect(context.decodeAudioData).not.toHaveBeenCalled();
    expect(sources).toHaveLength(0);
    await track.start();
    expect(sources).toHaveLength(1);
    expect(fetchTrack).toHaveBeenCalledTimes(2);
  });
});

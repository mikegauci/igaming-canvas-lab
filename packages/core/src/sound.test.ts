import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStore } from './storage';

const mocks = vi.hoisted(() => ({
  context: { state: 'suspended', resume: vi.fn() },
  start: vi.fn(),
  pause: vi.fn(),
  setMuted: vi.fn(),
  destroy: vi.fn(),
  muteAll: vi.fn(),
  unmuteAll: vi.fn(),
}));
vi.mock('@pixi/sound', () => ({
  sound: {
    context: { audioContext: mocks.context },
    muteAll: mocks.muteAll,
    unmuteAll: mocks.unmuteAll,
  },
}));
vi.mock('./background-music', () => ({
  BackgroundMusic: class {
    start = mocks.start;
    pause = mocks.pause;
    setMuted = mocks.setMuted;
    destroy = mocks.destroy;
  },
}));

import { SoundManager } from './sound';

describe('shared lobby/game audio lifecycle', () => {
  let page: EventTarget;
  let documentEvents: EventTarget & { hidden: boolean };
  let manager: SoundManager;

  beforeEach(() => {
    vi.clearAllMocks();
    page = new EventTarget();
    documentEvents = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal('window', page);
    vi.stubGlobal('document', documentEvents);
    mocks.context.state = 'suspended';
    mocks.context.resume.mockImplementation(async () => {
      if (mocks.context.state !== 'running') throw new Error('Gesture required');
    });
    manager = new SoundManager(memoryStore());
  });

  afterEach(() => {
    manager.destroy();
    vi.unstubAllGlobals();
  });

  it.each(['pointerdown', 'keydown'])(
    'unlocks music on %s after initial autoplay is blocked',
    async (event) => {
      await Promise.resolve();
      expect(mocks.start).not.toHaveBeenCalled();
      mocks.context.state = 'running';
      page.dispatchEvent(new Event(event));
      expect(mocks.start).toHaveBeenCalledOnce();
    },
  );

  it('mutes music and effects together and remembers the choice', () => {
    const store = memoryStore();
    manager.destroy();
    manager = new SoundManager(store);
    manager.setMuted(true);
    expect(mocks.muteAll).toHaveBeenCalledOnce();
    expect(mocks.setMuted).toHaveBeenLastCalledWith(true);
    expect(store.get('lab:muted')).toBe('1');
    manager.toggle();
    expect(mocks.setMuted).toHaveBeenLastCalledWith(false);
    expect(store.get('lab:muted')).toBe('0');
  });

  it('pauses hidden pages and resumes on return or restoration from page cache', () => {
    mocks.context.state = 'running';
    documentEvents.hidden = true;
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    expect(mocks.pause).toHaveBeenCalledOnce();
    page.dispatchEvent(new Event('pointerdown'));
    expect(mocks.start).not.toHaveBeenCalled();
    documentEvents.hidden = false;
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    expect(mocks.start).toHaveBeenCalledOnce();
    page.dispatchEvent(new Event('pagehide'));
    page.dispatchEvent(new Event('pointerdown'));
    expect(mocks.start).toHaveBeenCalledOnce();
    page.dispatchEvent(new Event('pageshow'));
    expect(mocks.start).toHaveBeenCalledTimes(2);
  });

  it('removes its listeners and blocks late resume callbacks after destruction', async () => {
    manager.destroy();
    mocks.context.state = 'running';
    page.dispatchEvent(new Event('pointerdown'));
    page.dispatchEvent(new Event('keydown'));
    page.dispatchEvent(new Event('pageshow'));
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});

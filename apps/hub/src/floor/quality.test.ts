import { describe, expect, it, vi } from 'vitest';
import { guessTier, pinnedTier, Quality } from './quality';

/** Feeds frames until `seconds` of frame time have passed. */
const run = (quality: Quality, seconds: number, frameMs: (i: number) => number) => {
  for (let i = 0, t = 0; t < seconds * 1000; i++) {
    const ms = frameMs(i);
    quality.sample(ms);
    t += ms;
  }
};
/** Overloaded frames: uneven, averaging ~33 ms. */
const jittery = (i: number) => (i % 2 ? 22 : 44);

describe('guessTier', () => {
  it('starts low-memory devices low', () => {
    expect(guessTier({ cores: 8, memory: 2 })).toBe('low');
  });

  it('does not trust a low core count alone', () => {
    expect(guessTier({ cores: 2, memory: 16 })).toBe('medium');
  });

  it('starts phones and mid-range machines at medium', () => {
    expect(guessTier({ cores: 8, memory: 8, coarsePointer: true })).toBe('medium');
    expect(guessTier({ cores: 4, memory: 8 })).toBe('medium');
  });

  it('starts strong desktops high', () => {
    expect(guessTier({ cores: 8, memory: 8 })).toBe('high');
    expect(guessTier({})).toBe('high');
  });
});

describe('pinnedTier', () => {
  it('reads a valid ?quality= and ignores anything else', () => {
    expect(pinnedTier('?quality=low')).toBe('low');
    expect(pinnedTier('?debug=1&quality=high')).toBe('high');
    expect(pinnedTier('?quality=ultra')).toBeNull();
    expect(pinnedTier('')).toBeNull();
  });
});

describe('Quality', () => {
  it('stays put while frames are fast', () => {
    const quality = new Quality('high');
    run(quality, 30, () => 16.7);
    expect(quality.tier).toBe('high');
  });

  it('steps down one tier after a slow window, then settles before judging again', () => {
    const quality = new Quality('high');
    const listener = vi.fn();
    quality.onChange(listener);
    run(quality, 3.6, jittery);
    expect(quality.tier).toBe('medium');
    expect(listener).toHaveBeenCalledWith({ tier: 'medium', maxResolution: 1.5 });
    run(quality, 3, jittery);
    expect(quality.tier).toBe('medium');
    run(quality, 1, jittery);
    expect(quality.tier).toBe('low');
    run(quality, 30, jittery);
    expect(quality.tier).toBe('low');
  });

  it('accepts a steady 30 fps cap but not a steady crawl', () => {
    const capped = new Quality('high');
    run(capped, 30, () => 33.3);
    expect(capped.tier).toBe('high');

    const crawling = new Quality('high');
    run(crawling, 4, () => 50);
    expect(crawling.tier).toBe('medium');
  });

  it('still steps down a device at 3 fps (frames over 250 ms are clamped, not dropped)', () => {
    const quality = new Quality('high');
    run(quality, 5, () => 333);
    expect(quality.tier).toBe('medium');
  });

  it('ignores warm-up frames and one-off hitches', () => {
    const quality = new Quality('high');
    run(quality, 1.5, () => 100);
    quality.sample(1000);
    run(quality, 2, () => 16.7);
    expect(quality.tier).toBe('high');
  });

  it('never changes a pinned tier', () => {
    const quality = new Quality('high', true);
    run(quality, 30, () => 50);
    expect(quality.tier).toBe('high');
  });
});
